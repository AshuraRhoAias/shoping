'use strict';

const ordersRepo = require('../db/repo/orders');

async function orderRoutes(fastify) {
  const ENC = 'user';
  const VALID_STATUSES = ['pending','confirmed','processing','shipped','delivered','cancelled','refunded'];

  // ── GET / ─────────────────────────────────────────────────────────────────────
  fastify.get('/', {
    preHandler: [fastify.requireRole('admin','superadmin','seller')],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page:     { type: 'integer', minimum: 1, default: 1 },
          limit:    { type: 'integer', minimum: 1, maximum: 500, default: 50 },
          branchId: { type: 'string' },
          status:   { type: 'string', enum: VALID_STATUSES },
          from:     { type: 'string', format: 'date-time' },
          to:       { type: 'string', format: 'date-time' },
          userId:   { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const u = request.user;
    const q = { ...request.query };
    // Sellers only see their branch
    if (u.role === 'seller') q.branchId = u.branchId;

    const result = await ordersRepo.list(fastify.db, q);
    reply.header('X-Total-Count', String(result.total));
    return reply.sendEncrypted({ ...result, page: q.page, limit: q.limit }, ENC);
  });

  // ── POST / ────────────────────────────────────────────────────────────────────
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object', required: ['items','branchId'],
        properties: {
          branchId:        { type: 'string' },
          items: {
            type: 'array', minItems: 1,
            items: {
              type: 'object', required: ['productId','quantity'],
              properties: {
                productId: { type: 'string' },
                quantity:  { type: 'integer', minimum: 1 },
                unitPrice: { type: 'number',  minimum: 0 },
              },
            },
          },
          shippingAddress: { type: 'object' },
          paymentMethod:   { type: 'string' },
          notes:           { type: 'string', maxLength: 500 },
          discount:        { type: 'number', minimum: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const order = await ordersRepo.create(fastify.db, {
      userId: request.user.sub,
      ...request.body,
    });
    return reply.code(201).sendEncrypted({ order }, ENC);
  });

  // ── GET /:id ──────────────────────────────────────────────────────────────────
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, async (request, reply) => {
    const order = await ordersRepo.findById(fastify.db, request.params.id);
    if (!order) return reply.code(404).send({ error: 'Not Found' });

    const u = request.user;
    if (u.role === 'user' && order.userId !== u.sub)          return reply.code(403).send({ error: 'Forbidden' });
    if (u.role === 'seller' && order.branchId !== u.branchId) return reply.code(403).send({ error: 'Forbidden' });

    return reply.sendEncrypted({ order }, ENC);
  });

  // ── PATCH /:id/status ─────────────────────────────────────────────────────────
  fastify.patch('/:id/status', {
    preHandler: [fastify.requireRole('admin','superadmin','seller')],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object', required: ['status'],
        properties: {
          status:  { type: 'string', enum: VALID_STATUSES },
          comment: { type: 'string', maxLength: 300 },
        },
      },
    },
  }, async (request, reply) => {
    const order = await ordersRepo.findById(fastify.db, request.params.id);
    if (!order) return reply.code(404).send({ error: 'Not Found' });

    const u = request.user;
    if (u.role === 'seller' && order.branchId !== u.branchId) return reply.code(403).send({ error: 'Forbidden' });

    const updated = await ordersRepo.updateStatus(fastify.db, request.params.id, request.body.status);
    return reply.sendEncrypted({ order: updated }, ENC);
  });

  // ── POST /:id/cancel ──────────────────────────────────────────────────────────
  fastify.post('/:id/cancel', {
    preHandler: [fastify.authenticate],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', properties: { reason: { type: 'string', maxLength: 300 } } },
    },
  }, async (request, reply) => {
    const order = await ordersRepo.findById(fastify.db, request.params.id);
    if (!order) return reply.code(404).send({ error: 'Not Found' });

    const u = request.user;
    if (u.role === 'user' && order.userId !== u.sub) return reply.code(403).send({ error: 'Forbidden' });
    if (!['pending','confirmed'].includes(order.status)) {
      return reply.code(422).send({ error: `No se puede cancelar un pedido con status: ${order.status}` });
    }

    const updated = await ordersRepo.cancel(fastify.db, request.params.id, request.body?.reason);
    return reply.sendEncrypted({ order: updated }, ENC);
  });

  // ── GET /branch/:branchId ─────────────────────────────────────────────────────
  fastify.get('/branch/:branchId', {
    preHandler: [fastify.requireRole('admin','superadmin','seller')],
    schema: {
      params: { type: 'object', required: ['branchId'], properties: { branchId: { type: 'string' } } },
      querystring: {
        type: 'object',
        properties: {
          page:   { type: 'integer', minimum: 1, default: 1 },
          limit:  { type: 'integer', minimum: 1, maximum: 500, default: 50 },
          status: { type: 'string', enum: VALID_STATUSES },
        },
      },
    },
  }, async (request, reply) => {
    const { branchId } = request.params;
    const u = request.user;
    if (u.role === 'seller' && u.branchId !== branchId) return reply.code(403).send({ error: 'Forbidden' });

    const result = await ordersRepo.list(fastify.db, { branchId, ...request.query });
    reply.header('X-Total-Count', String(result.total));
    return reply.sendEncrypted({ ...result, page: request.query.page, limit: request.query.limit }, ENC);
  });
}

module.exports = orderRoutes;
