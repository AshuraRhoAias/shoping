'use strict';

const fp   = require('fastify-plugin');
const cors = require('@fastify/cors');

async function corsPlugin(fastify) {
  // Allowed origins – comma-separated list from env, or a regex for sub-domains
  const rawOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  await fastify.register(cors, {
    origin: (origin, callback) => {
      // Allow server-to-server (no origin header)
      if (!origin) return callback(null, true);
      if (rawOrigins.includes(origin)) return callback(null, true);
      // Allow any *.yourdomain.com in production
      const domainPattern = process.env.CORS_DOMAIN_PATTERN;
      if (domainPattern && new RegExp(domainPattern).test(origin)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Branch-Token',
      'X-Request-ID',
      'X-API-Key',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
    credentials: true,
    maxAge: 86400, // preflight cache 24 h
  });
}

module.exports = fp(corsPlugin, { name: 'cors-plugin' });
