'use strict';

const fp           = require('fastify-plugin');
const { getPool }  = require('../db/index');

/**
 * Plugin de base de datos.
 * Decora fastify con `fastify.db` (el pool de conexiones).
 * Al cerrar el servidor cierra el pool limpiamente.
 */
async function dbPlugin(fastify) {
  const db = getPool();

  // Verificar conexión al arrancar
  try {
    await db.query('SELECT 1');
    fastify.log.info(`[db] Conexión exitosa (${db.type})`);
  } catch (err) {
    fastify.log.error(`[db] No se pudo conectar: ${err.message}`);
    throw err;
  }

  fastify.decorate('db', db);

  fastify.addHook('onClose', async () => {
    await db.end();
    fastify.log.info('[db] Pool cerrado');
  });
}

module.exports = fp(dbPlugin, { name: 'db-plugin' });
