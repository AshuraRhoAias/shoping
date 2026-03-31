'use strict';

const fp        = require('fastify-plugin');
const rateLimit = require('@fastify/rate-limit');

async function rateLimitPlugin(fastify) {
  // Global rate limiter – 100k req/h ≈ 2000 req/min per IP by default.
  // Tighten per-route with routeOptions.config.rateLimit.
  await fastify.register(rateLimit, {
    global: true,
    max: parseInt(process.env.RATE_LIMIT_MAX || '2000', 10),     // per window
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
    cache: 10000,                       // LRU cache size for IPs
    allowList: (process.env.RATE_LIMIT_ALLOWLIST || '')
      .split(',').map(s => s.trim()).filter(Boolean),
    keyGenerator: (request) =>
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.ip,
    errorResponseBuilder: (_request, context) => ({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Retry after ${context.after}`,
      retryAfter: context.after,
    }),
    // Stricter limits for auth endpoints (configured inline per-route)
    addHeaders: {
      'x-ratelimit-limit':     true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset':     true,
      'retry-after':           true,
    },
  });
}

module.exports = fp(rateLimitPlugin, { name: 'rate-limit-plugin' });
