'use strict';

const usersRepo = require('../db/repo/users');

async function authRoutes(fastify) {
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
    const db = fastify.db;

    const existing = await usersRepo.findByEmail(db, email);
    if (existing) {
      return reply.code(409).send({ error: 'Conflict', message: 'Email ya registrado' });
    }

    const user = await usersRepo.create(db, { name, email, password, role, branchId });
    return reply.code(201).sendEncrypted({ user }, encLevelForRole(role));
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
    const db = fastify.db;

    const found = await usersRepo.findByEmail(db, email);

    if (!found || !usersRepo.verifyPassword(password, found.password_hash)) {
      await new Promise(r => setTimeout(r, 200 + Math.random() * 100));
      return reply.code(401).send({ error: 'Unauthorized', message: 'Credenciales inválidas' });
    }

    const payload = { sub: found.id, role: found.role, branchId: found.branch_id };
    const [accessToken, refreshToken] = await Promise.all([
      reply.accessSign(payload),
      reply.refreshSign(payload),
    ]);

    const safeUser = usersRepo.toUser(found);
    const level    = encLevelForRole(found.role);
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
      return reply.code(401).send({ error: 'Unauthorized', message: 'Refresh token inválido' });
    }

    const found = await usersRepo.findById(fastify.db, decoded.sub);
    if (!found) return reply.code(401).send({ error: 'Unauthorized', message: 'Usuario no encontrado' });

    const payload = { sub: found.id, role: found.role, branchId: found.branch_id };
    const [accessToken, newRefresh] = await Promise.all([
      reply.accessSign(payload),
      reply.refreshSign(payload),
    ]);
    return reply.sendEncrypted({ accessToken, refreshToken: newRefresh }, encLevelForRole(found.role));
  });

  // ── POST /logout ─────────────────────────────────────────────────────────────
  fastify.post('/logout', {
    preHandler: [fastify.authenticate],
  }, async (_request, reply) => {
    return reply.send({ message: 'Sesión cerrada' });
  });

  // ── GET /me ──────────────────────────────────────────────────────────────────
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const row = await usersRepo.findById(fastify.db, request.user.sub);
    if (!row) return reply.code(404).send({ error: 'Not Found' });
    return reply.sendEncrypted({ user: usersRepo.toUser(row) }, encLevelForRole(row.role));
  });
}

module.exports = authRoutes;
