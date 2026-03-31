'use strict';

const crypto       = require('node:crypto');
const branchesRepo = require('../db/repo/branches');

async function branchRoutes(fastify) {
  const ENC = 'admin';

  // ── GET / ────────────────────────────────────────────────────────────────────
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          active: { type: 'boolean' },
          page:   { type: 'integer', minimum: 1, default: 1 },
          limit:  { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      },
    },
  }, async (request, reply) => {
    const { active, page, limit } = request.query;
    const result = await branchesRepo.list(fastify.db, { active, page, limit });
    reply.header('X-Total-Count', String(result.total));
    return reply.sendEncrypted({ ...result, page, limit }, ENC);
  });

  // ── GET /all/summary ─────────────────────────────────────────────────────────
  fastify.get('/all/summary', {
    preHandler: [fastify.requireRole('admin','superadmin')],
  }, async (_request, reply) => {
    const summary = await branchesRepo.summary(fastify.db);
    const totals  = summary.reduce((acc, b) => {
      acc.revenue   += b.revenue;
      acc.orders    += b.orders;
      return acc;
    }, { revenue: 0, orders: 0 });
    return reply.sendEncrypted({
      summary,
      totals: { ...totals, branches: summary.length },
      generatedAt: new Date().toISOString(),
    }, ENC);
  });

  // ── POST / ───────────────────────────────────────────────────────────────────
  fastify.post('/', {
    preHandler: [fastify.requireRole('admin','superadmin')],
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name:     { type: 'string', minLength: 2, maxLength: 120 },
          address:  { type: 'string' },
          phone:    { type: 'string' },
          timezone: { type: 'string', default: 'UTC' },
          active:   { type: 'boolean', default: true },
          metadata: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    const branch = await branchesRepo.create(fastify.db, request.body);
    return reply.code(201).sendEncrypted({ branch }, ENC);
  });

  // ── GET /:id ──────────────────────────────────────────────────────────────────
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, async (request, reply) => {
    const u = request.user;
    if (u.role === 'seller' && u.branchId !== request.params.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const branch = await branchesRepo.findById(fastify.db, request.params.id);
    if (!branch) return reply.code(404).send({ error: 'Not Found' });
    return reply.sendEncrypted({ branch }, ENC);
  });

  // ── PATCH /:id ────────────────────────────────────────────────────────────────
  fastify.patch('/:id', {
    preHandler: [fastify.requireRole('admin','superadmin','seller')],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          name:     { type: 'string' },
          address:  { type: 'string' },
          phone:    { type: 'string' },
          timezone: { type: 'string' },
          active:   { type: 'boolean' },
          metadata: { type: 'object' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const u = request.user;
    if (u.role === 'seller' && u.branchId !== request.params.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const branch = await branchesRepo.update(fastify.db, request.params.id, request.body);
    if (!branch) return reply.code(404).send({ error: 'Not Found' });
    return reply.sendEncrypted({ branch }, ENC);
  });

  // ── DELETE /:id ───────────────────────────────────────────────────────────────
  fastify.delete('/:id', {
    preHandler: [fastify.requireRole('superadmin')],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, async (request, reply) => {
    await branchesRepo.deactivate(fastify.db, request.params.id);
    return reply.send({ message: 'Sucursal desactivada', id: request.params.id });
  });

  // ── GET /:id/stats ────────────────────────────────────────────────────────────
  fastify.get('/:id/stats', {
    preHandler: [fastify.authenticate],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, async (request, reply) => {
    const branch = await branchesRepo.findById(fastify.db, request.params.id);
    if (!branch) return reply.code(404).send({ error: 'Not Found' });
    // Agregación básica de la sucursal
    const { rows } = await fastify.db.query(
      `SELECT
         COALESCE(SUM(o.total),0)::FLOAT   AS revenue,
         COUNT(o.id)                        AS orders,
         COALESCE(AVG(o.total),0)::FLOAT   AS avg_order_value
       FROM orders o
       WHERE o.branch_id = $1`,
      [request.params.id],
    );
    const stats = {
      branchId:      request.params.id,
      revenue:       Number(rows[0]?.revenue       || 0),
      orders:        Number(rows[0]?.orders        || 0),
      avgOrderValue: Number(rows[0]?.avg_order_value || 0),
      generatedAt:   new Date().toISOString(),
    };
    return reply.sendEncrypted({ stats }, ENC);
  });

  // ── GET /:id/inventory ────────────────────────────────────────────────────────
  fastify.get('/:id/inventory', {
    preHandler: [fastify.authenticate],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      querystring: {
        type: 'object',
        properties: {
          page:     { type: 'integer', minimum: 1, default: 1 },
          limit:    { type: 'integer', minimum: 1, maximum: 500, default: 100 },
          lowStock: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const { page, limit, lowStock } = request.query;
    const result = await branchesRepo.inventory(fastify.db, request.params.id, { page, limit, lowStock });
    reply.header('X-Total-Count', String(result.total));
    return reply.sendEncrypted({ ...result, page, limit }, ENC);
  });

  // ── POST /:id/sync ────────────────────────────────────────────────────────────
  fastify.post('/:id/sync', {
    preHandler: [fastify.requireRole('admin','superadmin')],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, async (request, reply) => {
    return reply.code(202).send({
      message:  'Sincronización en cola',
      branchId: request.params.id,
      syncId:   crypto.randomUUID(),
      queuedAt: new Date().toISOString(),
    });
  });
}

module.exports = branchRoutes;
