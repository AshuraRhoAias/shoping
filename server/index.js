'use strict';

require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });

const cluster = require('node:cluster');
const os      = require('node:os');

const NUM_WORKERS = parseInt(process.env.CLUSTER_WORKERS || String(os.cpus().length), 10);
const PORT        = parseInt(process.env.PORT || '4000', 10);
const HOST        = process.env.HOST || '0.0.0.0';

// ── Proceso primario: setup de DB + cluster ───────────────────────────────────
if (cluster.isPrimary) {
  (async () => {
    // 1. Verificar / crear la base de datos Docker antes de arrancar workers
    try {
      const { setupDB } = require('./scripts/setup-db');
      await setupDB();
    } catch (err) {
      console.error('\n  ❌  Error en setup de base de datos:', err.message);
      process.exit(1);
    }

    // 2. Si solo se quiere un worker (dev / test) arrancarlo inline
    if (NUM_WORKERS <= 1) {
      return startWorker();
    }

    // 3. Modo cluster
    console.log(`\n[primary] Arrancando ${NUM_WORKERS} workers en ${HOST}:${PORT}\n`);
    for (let i = 0; i < NUM_WORKERS; i++) cluster.fork();

    cluster.on('exit', (worker, code, signal) => {
      console.warn(`[primary] Worker ${worker.process.pid} terminó (${signal || code}). Reiniciando…`);
      cluster.fork();
    });
  })();
} else {
  // Workers no ejecutan setup – solo el primario lo hace
  startWorker();
}

// ── Worker: levanta Fastify ───────────────────────────────────────────────────
async function startWorker() {
  const buildApp = require('./app');
  const app = await buildApp();

  const close = async (signal) => {
    app.log.info(`[worker ${process.pid}] ${signal} – cerrando…`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => close('SIGTERM'));
  process.on('SIGINT',  () => close('SIGINT'));

  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
