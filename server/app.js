'use strict';

require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });

const Fastify  = require('fastify');
const helmet   = require('@fastify/helmet');
const compress = require('@fastify/compress');

// ── Plugins ───────────────────────────────────────────────────────────────────
const dbPlugin         = require('./plugins/db');
const corsPlugin       = require('./plugins/cors');
const jwtPlugin        = require('./plugins/jwt');
const encryptionPlugin = require('./plugins/encryption');
const rateLimitPlugin  = require('./plugins/rateLimit');

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/auth');
const userRoutes     = require('./routes/users');
const adminRoutes    = require('./routes/admin');
const branchRoutes   = require('./routes/branches');
const productRoutes  = require('./routes/products');
const orderRoutes    = require('./routes/orders');
const analyticsRoutes = require('./routes/analytics');

async function buildApp(opts = {}) {
  const app = Fastify({
    // High-throughput settings
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
    trustProxy: true,              // respect X-Forwarded-For
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
    disableRequestLogging: false,
    // Increase body limits for bulk operations
    bodyLimit: parseInt(process.env.BODY_LIMIT || String(5 * 1024 * 1024), 10), // 5 MB
    ...opts,
  });

  // ── Security ────────────────────────────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'"],
        styleSrc:   ["'self'", "'unsafe-inline'"],
        imgSrc:     ["'self'", 'data:', 'https:'],
      },
    },
  });

  await app.register(compress, { global: true, threshold: 1024 });

  // ── Core plugins ────────────────────────────────────────────────────────────
  await app.register(dbPlugin);
  await app.register(corsPlugin);
  await app.register(rateLimitPlugin);
  await app.register(jwtPlugin);
  await app.register(encryptionPlugin);

  // ── Health check (no auth, no rate-limit) ───────────────────────────────────
  app.get('/health', {
    config: { rateLimit: { max: 5000, timeWindow: '1 minute' } },
  }, async () => ({ status: 'ok', ts: Date.now(), pid: process.pid }));

  // ── API v1 ──────────────────────────────────────────────────────────────────
  await app.register(authRoutes,      { prefix: '/api/v1/auth' });
  await app.register(userRoutes,      { prefix: '/api/v1/users' });
  await app.register(adminRoutes,     { prefix: '/api/v1/admin' });
  await app.register(branchRoutes,    { prefix: '/api/v1/branches' });
  await app.register(productRoutes,   { prefix: '/api/v1/products' });
  await app.register(orderRoutes,     { prefix: '/api/v1/orders' });
  await app.register(analyticsRoutes, { prefix: '/api/v1/analytics' });

  // ── 404 handler ─────────────────────────────────────────────────────────────
  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: 'Not Found', message: 'Route not found' });
  });

  // ── Global error handler ────────────────────────────────────────────────────
  app.setErrorHandler((error, _request, reply) => {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) {
      app.log.error(error);
    }
    reply.code(statusCode).send({
      error: error.name || 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'Internal Server Error'
        : error.message,
      ...(error.validation ? { validation: error.validation } : {}),
    });
  });

  return app;
}

module.exports = buildApp;
