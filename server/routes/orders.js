'use strict';

const crypto = require('node:crypto');

/**
 * Order management routes.
 * Encryption: user level (4 layers) – orders contain payment/personal data.
 *
 * GET    /api/v1/orders              – list orders (admin/seller)
 * POST   /api/v1/orders              – create order
 * GET    /api/v1/orders/:id          – order detail
 * PATCH  /api/v1/orders/:id/status   – update order status
 * POST   /api/v1/orders/:id/cancel   – cancel order
 * GET    /api/v1/orders/branch/:branchId – orders by branch
 */
async function orderRoutes(fastify) {
  const ENC_LEVEL = 'user'; // 4-layer encryption

  const orders = new Map();

  const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

  // ── List orders ───────────────────────────────────────────────────────────────
  fastify.get('/', {
    preHandler: [fastify.requireRole('admin', 'superadmin', 'seller')],
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
    const { page = 1, limit = 50, branchId, status, userId } = request.query;

    let list = [...orders.values()];

    // Sellers see only their branch
    if (request.user.role === 'seller') {
      list = list.filter(o => o.branchId === request.user.branchId);
    } else {
      if (branchId) list = list.filter(o => o.branchId === branchId);
    }

    if (status) list = list.filter(o => o.status === status);
    if (userId) list = list.filter(o => o.userId === userId);

    const start = (page - 1) * limit;
    const slice = list.slice(start, start + limit);
    reply.header('X-Total-Count', String(list.length));
    return reply.sendEncrypted({ orders: slice, total: list.length, page, limit }, ENC_LEVEL);
  });

  // ── Create order ──────────────────────────────────────────────────────────────
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['items', 'branchId'],
        properties: {
          branchId: { type: 'string' },
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['productId', 'quantity'],
              properties: {
                productId: { type: 'string' },
                quantity:  { type: 'integer', minimum: 1 },
                unitPrice: { type: 'number', minimum: 0 },
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
    const id  = crypto.randomUUID();
    const now = new Date().toISOString();

    // Calculate total (production: fetch product prices from DB)
    const subtotal = request.body.items.reduce(
      (sum, item) => sum + (item.unitPrice || 0) * item.quantity, 0,
    );
    const discount = request.body.discount || 0;
    const tax      = subtotal * parseFloat(process.env.TAX_RATE || '0.16');
    const total    = subtotal - discount + tax;

    const order = {
      id,
      userId:          request.user.sub,
      branchId:        request.body.branchId,
      items:           request.body.items,
      shippingAddress: request.body.shippingAddress || null,
      paymentMethod:   request.body.paymentMethod || null,
      notes:           request.body.notes || null,
      subtotal,
      discount,
      tax,
      total,
      status:    'pending',
      createdAt: now,
      updatedAt: now,
    };

    orders.set(id, order);
    return reply.code(201).sendEncrypted({ order }, ENC_LEVEL);
  });

  // ── Get order ─────────────────────────────────────────────────────────────────
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
    const order = orders.get(request.params.id);
    if (!order) return reply.code(404).send({ error: 'Not Found' });

    const u = request.user;
    if (u.role === 'user' && order.userId !== u.sub) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    return reply.sendEncrypted({ order }, ENC_LEVEL);
  });

  // ── Update order status ───────────────────────────────────────────────────────
  fastify.patch('/:id/status', {
    preHandler: [fastify.requireRole('admin', 'superadmin', 'seller')],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status:  { type: 'string', enum: VALID_STATUSES },
          comment: { type: 'string', maxLength: 300 },
        },
      },
    },
  }, async (request, reply) => {
    const order = orders.get(request.params.id);
    if (!order) return reply.code(404).send({ error: 'Not Found' });

    const u = request.user;
    if (u.role === 'seller' && order.branchId !== u.branchId) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    order.status    = request.body.status;
    order.updatedAt = new Date().toISOString();
    return reply.sendEncrypted({ order }, ENC_LEVEL);
  });

  // ── Cancel order ──────────────────────────────────────────────────────────────
  fastify.post('/:id/cancel', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: { reason: { type: 'string', maxLength: 300 } },
      },
    },
  }, async (request, reply) => {
    const order = orders.get(request.params.id);
    if (!order) return reply.code(404).send({ error: 'Not Found' });

    const u = request.user;
    if (u.role === 'user' && order.userId !== u.sub) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    if (!['pending', 'confirmed'].includes(order.status)) {
      return reply.code(422).send({ error: 'Cannot cancel order with status: ' + order.status });
    }

    order.status          = 'cancelled';
    order.cancelReason    = request.body?.reason || null;
    order.cancelledAt     = new Date().toISOString();
    order.updatedAt       = order.cancelledAt;
    return reply.sendEncrypted({ order }, ENC_LEVEL);
  });

  // ── Orders by branch ──────────────────────────────────────────────────────────
  fastify.get('/branch/:branchId', {
    preHandler: [fastify.requireRole('admin', 'superadmin', 'seller')],
    schema: {
      params: {
        type: 'object',
        required: ['branchId'],
        properties: { branchId: { type: 'string' } },
      },
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

    if (u.role === 'seller' && u.branchId !== branchId) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const { page = 1, limit = 50, status } = request.query;
    let list = [...orders.values()].filter(o => o.branchId === branchId);
    if (status) list = list.filter(o => o.status === status);
    const start = (page - 1) * limit;
    reply.header('X-Total-Count', String(list.length));
    return reply.sendEncrypted({ orders: list.slice(start, start + limit), total: list.length, page, limit }, ENC_LEVEL);
  });
}

module.exports = orderRoutes;
