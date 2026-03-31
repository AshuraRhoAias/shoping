'use strict';

const usersRepo = require('../db/repo/users');
const ordersRepo = require('../db/repo/orders');

async function userRoutes(fastify) {
  const ENC = 'user';

  // ── GET / ────────────────────────────────────────────────────────────────────
  fastify.get('/', {
    preHandler: [fastify.requireRole('admin', 'superadmin')],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page:     { type: 'integer', minimum: 1, default: 1 },
          limit:    { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          branchId: { type: 'string' },
          role:     { type: 'string', enum: ['user','seller','admin','superadmin'] },
        },
      },
    },
  }, async (request, reply) => {
    const { page, limit, branchId, role } = request.query;
    const result = await usersRepo.list(fastify.db, { page, limit, branchId, role });
    reply.header('X-Total-Count', String(result.total));
    return reply.sendEncrypted({ ...result, page, limit }, ENC);
  });

  // ── GET /:id ─────────────────────────────────────────────────────────────────
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, async (request, reply) => {
    const { id } = request.params;
    const u      = request.user;
    if (u.sub !== id && !['admin','superadmin'].includes(u.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const row = await usersRepo.findById(fastify.db, id);
    if (!row) return reply.code(404).send({ error: 'Not Found' });
    return reply.sendEncrypted({ user: usersRepo.toUser(row) }, ENC);
  });

  // ── PATCH /:id ───────────────────────────────────────────────────────────────
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          name:     { type: 'string', minLength: 2, maxLength: 80 },
          email:    { type: 'string', format: 'email' },
          branchId: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const u      = request.user;
    if (u.sub !== id && !['admin','superadmin'].includes(u.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const updated = await usersRepo.update(fastify.db, id, request.body);
    if (!updated) return reply.code(404).send({ error: 'Not Found' });
    return reply.sendEncrypted({ user: updated }, ENC);
  });

  // ── DELETE /:id ──────────────────────────────────────────────────────────────
  fastify.delete('/:id', {
    preHandler: [fastify.requireRole('admin','superadmin')],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, async (request, reply) => {
    await usersRepo.remove(fastify.db, request.params.id);
    return reply.send({ message: `Usuario ${request.params.id} desactivado` });
  });

  // ── GET /:id/orders ──────────────────────────────────────────────────────────
  fastify.get('/:id/orders', {
    preHandler: [fastify.authenticate],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      querystring: {
        type: 'object',
        properties: {
          page:   { type: 'integer', minimum: 1, default: 1 },
          limit:  { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          status: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const u      = request.user;
    if (u.sub !== id && !['admin','superadmin'].includes(u.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { page, limit, status } = request.query;
    const result = await ordersRepo.list(fastify.db, { page, limit, status, userId: id });
    reply.header('X-Total-Count', String(result.total));
    return reply.sendEncrypted({ ...result, page, limit }, ENC);
  });
}

module.exports = userRoutes;
