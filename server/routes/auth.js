'use strict';

const crypto = require('node:crypto');

/**
 * POST /api/v1/auth/register   – create account (public level enc)
 * POST /api/v1/auth/login      – get access + refresh tokens
 * POST /api/v1/auth/refresh    – exchange refresh token
 * POST /api/v1/auth/logout     – revoke refresh token (blacklist in production)
 * GET  /api/v1/auth/me         – current user info
 */
async function authRoutes(fastify) {
  // ── In-memory user store (replace with DB in production) ────────────────────
  // Shape: Map<id, { id, name, email, passwordHash, role, branchId, createdAt }>
  const users = new Map();

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function hashPassword(password) {
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  function verifyPassword(password, stored) {
    const [salt, hash] = stored.split(':');
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
  }

  function encLevelForRole(role) {
    return ['admin', 'superadmin', 'seller'].includes(role) ? 'admin' : 'user';
  }

  // ── POST /register ───────────────────────────────────────────────────────────
  fastify.post('/register', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name:     { type: 'string', minLength: 2, maxLength: 80 },
          email:    { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          role:     { type: 'string', enum: ['user', 'seller'], default: 'user' },
          branchId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { name, email, password, role = 'user', branchId } = request.body;

    // Check duplicate
    for (const u of users.values()) {
      if (u.email === email) {
        return reply.code(409).send({ error: 'Conflict', message: 'Email already registered' });
      }
    }

    const id = crypto.randomUUID();
    const user = {
      id,
      name,
      email,
      passwordHash: hashPassword(password),
      role,
      branchId: branchId || null,
      createdAt: new Date().toISOString(),
    };
    users.set(id, user);

    const level = encLevelForRole(role);
    const { passwordHash: _ph, ...safeUser } = user;
    return reply.code(201).sendEncrypted({ user: safeUser }, level);
  });

  // ── POST /login ──────────────────────────────────────────────────────────────
  fastify.post('/login', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:    { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body;

    let found;
    for (const u of users.values()) {
      if (u.email === email) { found = u; break; }
    }

    if (!found || !verifyPassword(password, found.passwordHash)) {
      // Delay to prevent timing-based user enumeration
      await new Promise(r => setTimeout(r, 200 + Math.random() * 100));
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    const payload = { sub: found.id, role: found.role, branchId: found.branchId };
    const [accessToken, refreshToken] = await Promise.all([
      reply.accessSign(payload),
      reply.refreshSign(payload),
    ]);

    const level = encLevelForRole(found.role);
    const { passwordHash: _ph, ...safeUser } = found;
    return reply.sendEncrypted({ accessToken, refreshToken, user: safeUser }, level);
  });

  // ── POST /refresh ────────────────────────────────────────────────────────────
  fastify.post('/refresh', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: { refreshToken: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    let decoded;
    try {
      decoded = fastify.jwt.refresh.verify(request.body.refreshToken);
    } catch {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid refresh token' });
    }

    const user = users.get(decoded.sub);
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'User not found' });
    }

    const payload = { sub: user.id, role: user.role, branchId: user.branchId };
    const [accessToken, newRefreshToken] = await Promise.all([
      reply.accessSign(payload),
      reply.refreshSign(payload),
    ]);

    return reply.sendEncrypted({ accessToken, refreshToken: newRefreshToken }, encLevelForRole(user.role));
  });

  // ── POST /logout ─────────────────────────────────────────────────────────────
  fastify.post('/logout', {
    preHandler: [fastify.authenticate],
  }, async (_request, reply) => {
    // In production: add refresh token to a Redis blacklist with TTL = remaining expiry
    return reply.send({ message: 'Logged out successfully' });
  });

  // ── GET /me ──────────────────────────────────────────────────────────────────
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = users.get(request.user.sub);
    if (!user) return reply.code(404).send({ error: 'Not Found' });
    const { passwordHash: _ph, ...safeUser } = user;
    return reply.sendEncrypted({ user: safeUser }, encLevelForRole(user.role));
  });
}

module.exports = authRoutes;
