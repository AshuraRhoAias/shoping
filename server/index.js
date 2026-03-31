'use strict';

/**
 * Cluster entry-point.
 *
 * Spawns one worker per CPU core (or CLUSTER_WORKERS env var).
 * Each worker runs a full Fastify instance, so the process pool
 * can comfortably handle 100k+ requests/hour.
 *
 * Usage:
 *   node index.js           → cluster mode (auto workers)
 *   CLUSTER_WORKERS=1 node index.js  → single process (dev)
 */

const cluster = require('node:cluster');
const os      = require('node:os');

const NUM_WORKERS  = parseInt(process.env.CLUSTER_WORKERS || String(os.cpus().length), 10);
const PORT         = parseInt(process.env.PORT || '4000', 10);
const HOST         = process.env.HOST || '0.0.0.0';

if (cluster.isPrimary && NUM_WORKERS > 1) {
  console.log(`[primary] Starting ${NUM_WORKERS} workers on ${HOST}:${PORT}`);

  for (let i = 0; i < NUM_WORKERS; i++) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    console.warn(`[primary] Worker ${worker.process.pid} died (${signal || code}). Restarting…`);
    cluster.fork();
  });
} else {
  startWorker();
}

async function startWorker() {
  const buildApp = require('./app');

  const app = await buildApp();

  const close = async (signal) => {
    app.log.info(`[worker ${process.pid}] ${signal} received – graceful shutdown`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => close('SIGTERM'));
  process.on('SIGINT',  () => close('SIGINT'));

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`[worker ${process.pid}] listening on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
