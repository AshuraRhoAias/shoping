'use strict';

const fp  = require('fastify-plugin');
const jwt = require('@fastify/jwt');

/**
 * JWT plugin with three token types:
 *   access  – short-lived (15 min)
 *   refresh – long-lived  (7 days)
 *   branch  – per-branch  (24 h)
 *
 * Payload shape:
 *   { sub, role, branchId?, iat, exp }
 *
 * Roles:  'public' | 'user' | 'seller' | 'admin' | 'superadmin'
 */
async function jwtPlugin(fastify) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 64) {
    throw new Error('JWT_SECRET must be at least 64 characters');
  }

  // ── Main access token ───────────────────────────────────────────────────────
  await fastify.register(jwt, {
    secret,
    sign: { algorithm: 'HS512', expiresIn: process.env.JWT_ACCESS_TTL || '15m' },
    verify: { algorithms: ['HS512'] },
    namespace: 'access',
    jwtVerify: 'accessVerify',
    jwtSign: 'accessSign',
  });

  // ── Refresh token (longer TTL, separate namespace) ──────────────────────────
  await fastify.register(jwt, {
    secret: secret + ':refresh',
    sign: { algorithm: 'HS512', expiresIn: process.env.JWT_REFRESH_TTL || '7d' },
    verify: { algorithms: ['HS512'] },
    namespace: 'refresh',
    jwtVerify: 'refreshVerify',
    jwtSign: 'refreshSign',
  });

  // ── Branch token (per-branch API access) ────────────────────────────────────
  await fastify.register(jwt, {
    secret: secret + ':branch',
    sign: { algorithm: 'HS512', expiresIn: process.env.JWT_BRANCH_TTL || '24h' },
    verify: { algorithms: ['HS512'] },
    namespace: 'branch',
    jwtVerify: 'branchVerify',
    jwtSign: 'branchSign',
  });

  // ── Decorators for guard hooks ──────────────────────────────────────────────

  /** Require a valid access token. Attaches `request.user`. */
  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.accessVerify();
    } catch {
      reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
    }
  });

  /** Require one of the allowed roles. */
  fastify.decorate('requireRole', function (...roles) {
    return async function (request, reply) {
      await fastify.authenticate(request, reply);
      if (reply.sent) return;
      if (!roles.includes(request.user?.role)) {
        reply.code(403).send({ error: 'Forbidden', message: 'Insufficient permissions' });
      }
    };
  });

  /** Require a valid branch token (for branch sub-API). */
  fastify.decorate('authenticateBranch', async function (request, reply) {
    try {
      await request.branchVerify();
    } catch {
      reply.code(401).send({ error: 'Unauthorized', message: 'Invalid branch token' });
    }
  });
}

module.exports = fp(jwtPlugin, { name: 'jwt-plugin' });
