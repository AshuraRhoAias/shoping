'use strict';

/**
 * setup-db.js
 *
 * Wizard interactivo de primer arranque.
 *
 * Flujo:
 *  1. Lee .env y busca CREATE_WEB
 *  2. Si existe → la DB ya fue creada, sale inmediatamente
 *  3. Si NO existe → pregunta en consola:
 *       - Tipo de DB  (postgres | mysql)
 *       - Nombre del contenedor Docker
 *       - Nombre de la base de datos
 *       - Usuario
 *       - Contraseña  (o genera una automáticamente)
 *       - Puerto del host
 *  4. Verifica que Docker esté disponible
 *  5. Levanta el contenedor Docker con `docker run`
 *  6. Espera a que el motor acepte conexiones (health-check interno)
 *  7. Ejecuta el schema SQL inicial
 *  8. Escribe en .env:  DB_TYPE, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, CREATE_WEB
 *
 * CREATE_WEB = sha256( type+host+port+name+user + MASTER_SECRET ) → hex
 * Esto lo hace único por instalación y no reversible sin la clave maestra.
 */

const path     = require('node:path');
const fs       = require('node:fs');
const crypto   = require('node:crypto');
const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const { execSync, execFileSync } = require('node:child_process');

const ENV_PATH = path.join(__dirname, '..', '.env');

// ── utilidades .env ────────────────────────────────────────────────────────────

function readEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split('\n');
  const map   = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let   val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map[key] = val;
  }
  return map;
}

function writeEnvVars(newVars) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  for (const [key, val] of Object.entries(newVars)) {
    const escaped = val.includes(' ') || val.includes('#') ? `"${val}"` : val;
    const regex   = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${escaped}`);
    } else {
      content += `\n${key}=${escaped}`;
    }
  }
  if (!content.endsWith('\n')) content += '\n';
  fs.writeFileSync(ENV_PATH, content, 'utf8');
}

// ── helpers ────────────────────────────────────────────────────────────────────

function generatePassword(len = 24) {
  return crypto.randomBytes(len).toString('base64url').slice(0, len);
}

function computeCreateWeb(type, host, port, dbName, user, masterSecret) {
  return crypto
    .createHmac('sha256', masterSecret || 'no-master-secret')
    .update(`${type}:${host}:${port}:${dbName}:${user}`)
    .digest('hex');
}

function dockerAvailable() {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function containerExists(name) {
  try {
    const out = execFileSync('docker', ['ps', '-a', '--filter', `name=^/${name}$`, '--format', '{{.Names}}'], { encoding: 'utf8' });
    return out.trim() === name;
  } catch {
    return false;
  }
}

function containerRunning(name) {
  try {
    const out = execFileSync('docker', ['inspect', '--format', '{{.State.Running}}', name], { encoding: 'utf8' });
    return out.trim() === 'true';
  } catch {
    return false;
  }
}

// ── docker run ────────────────────────────────────────────────────────────────

function launchPostgres({ containerName, dbName, user, password, hostPort }) {
  console.log(`\n  🐳  Descargando imagen postgres:16-alpine…`);
  execSync(`docker pull postgres:16-alpine`, { stdio: 'inherit' });

  const args = [
    'run', '--name', containerName,
    '-e', `POSTGRES_DB=${dbName}`,
    '-e', `POSTGRES_USER=${user}`,
    '-e', `POSTGRES_PASSWORD=${password}`,
    '-p', `${hostPort}:5432`,
    '--restart', 'unless-stopped',
    '-d', 'postgres:16-alpine',
  ];
  execFileSync('docker', args, { stdio: 'inherit' });
}

function launchMySQL({ containerName, dbName, user, password, hostPort }) {
  console.log(`\n  🐳  Descargando imagen mysql:8.3…`);
  execSync(`docker pull mysql:8.3`, { stdio: 'inherit' });

  const args = [
    'run', '--name', containerName,
    '-e', `MYSQL_DATABASE=${dbName}`,
    '-e', `MYSQL_USER=${user}`,
    '-e', `MYSQL_PASSWORD=${password}`,
    '-e', `MYSQL_ROOT_PASSWORD=${password}`,
    '-p', `${hostPort}:3306`,
    '--restart', 'unless-stopped',
    '-d', 'mysql:8.3',
    '--character-set-server=utf8mb4',
    '--collation-server=utf8mb4_unicode_ci',
  ];
  execFileSync('docker', args, { stdio: 'inherit' });
}

// ── health-check: espera hasta que la DB acepte conexiones ────────────────────

async function waitForDB({ type, host, port, dbName, user, password }, timeoutMs = 60_000) {
  const start = Date.now();
  console.log('\n  ⏳  Esperando a que la base de datos esté lista…');

  while (Date.now() - start < timeoutMs) {
    try {
      if (type === 'postgres') {
        const { Client } = require('pg');
        const client = new Client({ host, port: Number(port), database: dbName, user, password, connectionTimeoutMillis: 3000 });
        await client.connect();
        await client.end();
        return;
      } else {
        const mysql = require('mysql2/promise');
        const conn  = await mysql.createConnection({ host, port: Number(port), database: dbName, user, password, connectTimeout: 3000 });
        await conn.end();
        return;
      }
    } catch {
      await new Promise(r => setTimeout(r, 2000));
      process.stdout.write('.');
    }
  }
  throw new Error('Tiempo de espera agotado – la DB no respondió en 60 s');
}

// ── aplicar schema SQL ────────────────────────────────────────────────────────

async function applySchema({ type, host, port, dbName, user, password }) {
  const schemaFile = path.join(__dirname, '..', 'db', 'schema', `${type}.sql`);
  if (!fs.existsSync(schemaFile)) {
    console.warn(`  ⚠️   Schema no encontrado en ${schemaFile}. Omitiendo.`);
    return;
  }
  const sql = fs.readFileSync(schemaFile, 'utf8');
  console.log('\n  📋  Aplicando schema…');

  if (type === 'postgres') {
    const { Client } = require('pg');
    const client = new Client({ host, port: Number(port), database: dbName, user, password });
    await client.connect();
    await client.query(sql);
    await client.end();
  } else {
    const mysql = require('mysql2/promise');
    const conn  = await mysql.createConnection({ host, port: Number(port), database: dbName, user, password, multipleStatements: true });
    await conn.query(sql);
    await conn.end();
  }
  console.log('  ✅  Schema aplicado correctamente.');
}

// ── wizard principal ──────────────────────────────────────────────────────────

async function setupDB() {
  const env = readEnv();

  // ── ¿Ya está configurada la DB? ──────────────────────────────────────────────
  if (env.CREATE_WEB) {
    const expected = computeCreateWeb(
      env.DB_TYPE, env.DB_HOST, env.DB_PORT, env.DB_NAME, env.DB_USER,
      env.MASTER_SECRET,
    );
    if (env.CREATE_WEB === expected) {
      console.log('  ✅  Base de datos ya configurada. Saltando setup.\n');
      return;
    }
    console.warn('  ⚠️   CREATE_WEB no coincide con la configuración actual. Re-ejecutando setup…\n');
  }

  // ── Verificar Docker ─────────────────────────────────────────────────────────
  if (!dockerAvailable()) {
    throw new Error('Docker no está disponible. Instala Docker Desktop o Docker Engine y vuelve a intentarlo.');
  }

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║        Configuración inicial de base de datos        ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const rl = readline.createInterface({ input, output });

  const ask = async (question, defaultVal = '') => {
    const hint = defaultVal ? ` [${defaultVal}]` : '';
    const ans  = await rl.question(`  ${question}${hint}: `);
    return ans.trim() || defaultVal;
  };

  const askSecret = async (question) => {
    const auto = generatePassword();
    process.stdout.write(`  ${question} [dejar vacío = generar automáticamente]: `);
    const ans = await rl.question('');
    return ans.trim() || auto;
  };

  // ── Preguntas ────────────────────────────────────────────────────────────────
  const typeRaw      = await ask('Tipo de base de datos (1=PostgreSQL, 2=MySQL)', '1');
  const type         = typeRaw === '2' ? 'mysql' : 'postgres';
  const defaultPort  = type === 'postgres' ? '5432' : '3306';

  const containerName = await ask('Nombre del contenedor Docker',        'shop-db');
  const dbName        = await ask('Nombre de la base de datos',          'shopdb');
  const user          = await ask('Usuario',                             'shopuser');
  const password      = await askSecret('Contraseña');
  const hostPort      = await ask('Puerto del host',                     defaultPort);

  rl.close();

  // ── Mostrar resumen ──────────────────────────────────────────────────────────
  console.log('\n  ┌─────────────────────────────────────────┐');
  console.log(`  │  Tipo        : ${type.padEnd(25)}│`);
  console.log(`  │  Contenedor  : ${containerName.padEnd(25)}│`);
  console.log(`  │  Base de datos: ${dbName.padEnd(24)}│`);
  console.log(`  │  Usuario     : ${user.padEnd(25)}│`);
  console.log(`  │  Contraseña  : ${'*'.repeat(Math.min(password.length,12)).padEnd(25)}│`);
  console.log(`  │  Puerto host : ${hostPort.padEnd(25)}│`);
  console.log('  └─────────────────────────────────────────┘\n');

  // ── Levantar contenedor ──────────────────────────────────────────────────────
  if (containerExists(containerName)) {
    if (!containerRunning(containerName)) {
      console.log(`  🔄  Iniciando contenedor existente "${containerName}"…`);
      execFileSync('docker', ['start', containerName], { stdio: 'inherit' });
    } else {
      console.log(`  ♻️   El contenedor "${containerName}" ya está corriendo.`);
    }
  } else {
    const cfg = { containerName, dbName, user, password, hostPort };
    if (type === 'postgres') launchPostgres(cfg);
    else                      launchMySQL(cfg);
    console.log(`\n  🚀  Contenedor "${containerName}" creado y arrancado.`);
  }

  const host = '127.0.0.1';

  // ── Esperar conexión ─────────────────────────────────────────────────────────
  await waitForDB({ type, host, port: hostPort, dbName, user, password });
  console.log('\n  ✅  Conexión exitosa.');

  // ── Aplicar schema ───────────────────────────────────────────────────────────
  await applySchema({ type, host, port: hostPort, dbName, user, password });

  // ── Escribir .env ─────────────────────────────────────────────────────────────
  const createWeb = computeCreateWeb(type, host, hostPort, dbName, user, env.MASTER_SECRET || '');

  writeEnvVars({
    DB_TYPE:     type,
    DB_HOST:     host,
    DB_PORT:     hostPort,
    DB_NAME:     dbName,
    DB_USER:     user,
    DB_PASSWORD: password,
    DB_POOL_MIN: '2',
    DB_POOL_MAX: '20',
    CREATE_WEB:  createWeb,
  });

  console.log('\n  💾  Variables escritas en .env');
  console.log(`  🔑  CREATE_WEB=${createWeb}\n`);
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   ✅  Setup completado. Iniciando servidor…          ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
}

module.exports = { setupDB };

// Permite ejecutarse directo: node scripts/setup-db.js
if (require.main === module) {
  setupDB().catch(err => {
    console.error('\n  ❌  Error en setup:', err.message);
    process.exit(1);
  });
}
