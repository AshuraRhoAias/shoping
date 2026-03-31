'use strict';

const crypto = require('node:crypto');

/**
 * Branch management routes.
 * Each branch can be a physical store, warehouse, or sub-franchise.
 *
 * GET    /api/v1/branches              – list branches
 * POST   /api/v1/branches              – create branch (admin)
 * GET    /api/v1/branches/:id          – branch detail
 * PATCH  /api/v1/branches/:id          – update branch (admin)
 * DELETE /api/v1/branches/:id          – deactivate branch (superadmin)
 * GET    /api/v1/branches/:id/stats    – branch KPIs
 * GET    /api/v1/branches/:id/inventory – branch inventory
 * POST   /api/v1/branches/:id/sync     – force data sync from branch
 * GET    /api/v1/branches/all/summary  – aggregate view of ALL branches
 */
async function branchRoutes(fastify) {
  const ENC_LEVEL = 'admin'; // branch data is privileged

  // In-memory store (replace with DB)
  const branches = new Map();

  // Seed a demo branch
  branches.set('main', {
    id: 'main',
    name: 'Main Store',
    address: '123 Main St',
    phone: '+1-555-0100',
    timezone: 'America/Mexico_City',
    active: true,
    createdAt: new Date().toISOString(),
  });

  // ── List all branches ────────────────────────────────────────────────────────
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
    const { active, page = 1, limit = 50 } = request.query;
    let list = [...branches.values()];
    if (active !== undefined) list = list.filter(b => b.active === active);
    const start = (page - 1) * limit;
    const slice = list.slice(start, start + limit);
    reply.header('X-Total-Count', String(list.length));
    return reply.sendEncrypted({ branches: slice, total: list.length, page, limit }, ENC_LEVEL);
  });

  // ── Aggregate all-branches summary ───────────────────────────────────────────
  fastify.get('/all/summary', {
    preHandler: [fastify.requireRole('admin', 'superadmin')],
  }, async (_request, reply) => {
    const summary = [...branches.values()].map(b => ({
      id: b.id,
      name: b.name,
      active: b.active,
      // In production: join with real-time KPI data per branch
      revenue: 0,
      orders:  0,
      stock:   0,
    }));
    return reply.sendEncrypted({
      summary,
      totals: { revenue: 0, orders: 0, branches: branches.size },
      generatedAt: new Date().toISOString(),
    }, ENC_LEVEL);
  });

  // ── Create branch ────────────────────────────────────────────────────────────
  fastify.post('/', {
    preHandler: [fastify.requireRole('admin', 'superadmin')],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'address'],
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
    const id     = crypto.randomUUID();
    const branch = { id, ...request.body, createdAt: new Date().toISOString() };
    branches.set(id, branch);
    return reply.code(201).sendEncrypted({ branch }, ENC_LEVEL);
  });

  // ── Get branch ───────────────────────────────────────────────────────────────
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
    const branch = branches.get(request.params.id);
    if (!branch) return reply.code(404).send({ error: 'Not Found', message: 'Branch not found' });

    // Sellers can only see their own branch
    const u = request.user;
    if (u.role === 'seller' && u.branchId !== request.params.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    return reply.sendEncrypted({ branch }, ENC_LEVEL);
  });

  // ── Update branch ─────────────────────────────────────────────────────────────
  fastify.patch('/:id', {
    preHandler: [fastify.requireRole('admin', 'superadmin', 'seller')],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
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
    const branch = branches.get(request.params.id);
    if (!branch) return reply.code(404).send({ error: 'Not Found' });

    const u = request.user;
    if (u.role === 'seller' && u.branchId !== request.params.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    Object.assign(branch, request.body, { updatedAt: new Date().toISOString() });
    return reply.sendEncrypted({ branch }, ENC_LEVEL);
  });

  // ── Delete / deactivate branch ───────────────────────────────────────────────
  fastify.delete('/:id', {
    preHandler: [fastify.requireRole('superadmin')],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const branch = branches.get(request.params.id);
    if (!branch) return reply.code(404).send({ error: 'Not Found' });
    branch.active = false;
    branch.deactivatedAt = new Date().toISOString();
    return reply.send({ message: 'Branch deactivated', id: request.params.id });
  });

  // ── Branch stats (KPIs) ──────────────────────────────────────────────────────
  fastify.get('/:id/stats', {
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
          from: { type: 'string', format: 'date-time' },
          to:   { type: 'string', format: 'date-time' },
        },
      },
    },
  }, async (request, reply) => {
    const branch = branches.get(request.params.id);
    if (!branch) return reply.code(404).send({ error: 'Not Found' });

    // Placeholder – query aggregated stats from DB
    const stats = {
      branchId:       request.params.id,
      revenue:        0,
      orders:         0,
      avgOrderValue:  0,
      topProducts:    [],
      stockAlerts:    [],
      generatedAt:    new Date().toISOString(),
    };
    return reply.sendEncrypted({ stats }, ENC_LEVEL);
  });

  // ── Branch inventory ──────────────────────────────────────────────────────────
  fastify.get('/:id/inventory', {
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
          page:    { type: 'integer', minimum: 1, default: 1 },
          limit:   { type: 'integer', minimum: 1, maximum: 500, default: 100 },
          lowStock:{ type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const { page = 1, limit = 100 } = request.query;
    // Placeholder
    return reply.sendEncrypted({ inventory: [], total: 0, page, limit }, ENC_LEVEL);
  });

  // ── Force sync from branch ────────────────────────────────────────────────────
  fastify.post('/:id/sync', {
    preHandler: [fastify.requireRole('admin', 'superadmin')],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    // Placeholder – trigger a background sync job (queue, webhook, etc.)
    return reply.code(202).send({
      message:   'Sync triggered',
      branchId:  request.params.id,
      syncId:    crypto.randomUUID(),
      queuedAt:  new Date().toISOString(),
    });
  });
}

module.exports = branchRoutes;
