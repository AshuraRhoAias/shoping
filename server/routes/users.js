'use strict';

/**
 * User / client routes – all responses encrypted at LEVEL 4 (user).
 *
 * GET    /api/v1/users          – list users (admin only)
 * GET    /api/v1/users/:id      – get user profile
 * PATCH  /api/v1/users/:id      – update user profile
 * DELETE /api/v1/users/:id      – delete user (admin only)
 * GET    /api/v1/users/:id/orders – user's orders
 */
async function userRoutes(fastify) {
  // Shared in-memory store (production: inject via plugin/DB)
  const ENC_LEVEL = 'user'; // 4-layer encryption for all user data

  // ── List users (admin/superadmin only) ───────────────────────────────────────
  fastify.get('/', {
    preHandler: [fastify.requireRole('admin', 'superadmin')],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page:     { type: 'integer', minimum: 1, default: 1 },
          limit:    { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          branchId: { type: 'string' },
          role:     { type: 'string', enum: ['user', 'seller', 'admin', 'superadmin'] },
        },
      },
    },
  }, async (request, reply) => {
    // Placeholder – replace with DB query + pagination
    const { page = 1, limit = 50 } = request.query;
    const data = { users: [], total: 0, page, limit };
    reply.header('X-Total-Count', '0');
    return reply.sendEncrypted(data, ENC_LEVEL);
  });

  // ── Get single user ──────────────────────────────────────────────────────────
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const requester = request.user;

    // Users can only see themselves; admin can see anyone
    if (requester.sub !== id && !['admin', 'superadmin'].includes(requester.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // Placeholder
    const user = { id, name: 'Example User', email: 'user@example.com', role: 'user' };
    return reply.sendEncrypted({ user }, ENC_LEVEL);
  });

  // ── Update user ──────────────────────────────────────────────────────────────
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          name:     { type: 'string', minLength: 2, maxLength: 80 },
          email:    { type: 'string', format: 'email' },
          phone:    { type: 'string' },
          address:  { type: 'object' },
          branchId: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const { id }    = request.params;
    const requester = request.user;

    if (requester.sub !== id && !['admin', 'superadmin'].includes(requester.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // Placeholder – update in DB, return updated user
    const updated = { id, ...request.body, updatedAt: new Date().toISOString() };
    return reply.sendEncrypted({ user: updated }, ENC_LEVEL);
  });

  // ── Delete user (admin) ──────────────────────────────────────────────────────
  fastify.delete('/:id', {
    preHandler: [fastify.requireRole('admin', 'superadmin')],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    // Placeholder – soft-delete in DB
    return reply.send({ message: `User ${id} deleted` });
  });

  // ── User orders ──────────────────────────────────────────────────────────────
  fastify.get('/:id/orders', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
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
    const { id }    = request.params;
    const requester = request.user;

    if (requester.sub !== id && !['admin', 'superadmin'].includes(requester.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const { page = 1, limit = 20 } = request.query;
    // Placeholder
    const data = { orders: [], total: 0, page, limit };
    return reply.sendEncrypted(data, ENC_LEVEL);
  });
}

module.exports = userRoutes;
