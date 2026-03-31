'use strict';

/**
 * Analytics / reporting routes.
 * Encryption: admin level (5 layers) – financial data.
 *
 * GET /api/v1/analytics/overview          – global KPIs
 * GET /api/v1/analytics/revenue           – revenue breakdown (period + branch)
 * GET /api/v1/analytics/products          – top / bottom products
 * GET /api/v1/analytics/users             – user acquisition & retention
 * GET /api/v1/analytics/branches          – per-branch comparison
 * GET /api/v1/analytics/branches/:id      – single-branch deep-dive
 */
async function analyticsRoutes(fastify) {
  const ENC_LEVEL = 'admin'; // 5-layer encryption for financial data

  fastify.addHook('preHandler', fastify.requireRole('admin', 'superadmin', 'seller'));

  // ── Global overview ───────────────────────────────────────────────────────────
  fastify.get('/overview', async (_request, reply) => {
    // Placeholder – replace with real aggregation queries
    return reply.sendEncrypted({
      totalRevenue:         0,
      totalOrders:          0,
      totalUsers:           0,
      totalProducts:        0,
      activeBranches:       0,
      ordersToday:          0,
      revenueToday:         0,
      conversionRate:       0,
      averageOrderValue:    0,
      generatedAt:          new Date().toISOString(),
    }, ENC_LEVEL);
  });

  // ── Revenue breakdown ─────────────────────────────────────────────────────────
  fastify.get('/revenue', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          from:       { type: 'string', format: 'date-time' },
          to:         { type: 'string', format: 'date-time' },
          branchId:   { type: 'string' },
          granularity:{ type: 'string', enum: ['hour', 'day', 'week', 'month'], default: 'day' },
        },
      },
    },
  }, async (request, reply) => {
    const { granularity = 'day', branchId } = request.query;
    // Placeholder – time-series query
    return reply.sendEncrypted({
      granularity,
      branchId:    branchId || 'all',
      series:      [],
      totals:      { revenue: 0, orders: 0, refunds: 0 },
      generatedAt: new Date().toISOString(),
    }, ENC_LEVEL);
  });

  // ── Product analytics ─────────────────────────────────────────────────────────
  fastify.get('/products', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          from:     { type: 'string', format: 'date-time' },
          to:       { type: 'string', format: 'date-time' },
          branchId: { type: 'string' },
          sort:     { type: 'string', enum: ['revenue', 'quantity', 'returns'], default: 'revenue' },
          limit:    { type: 'integer', minimum: 1, maximum: 200, default: 20 },
        },
      },
    },
  }, async (request, reply) => {
    return reply.sendEncrypted({
      topProducts:    [],
      bottomProducts: [],
      lowStock:       [],
      generatedAt:    new Date().toISOString(),
    }, ENC_LEVEL);
  });

  // ── User analytics ────────────────────────────────────────────────────────────
  fastify.get('/users', {
    preHandler: [fastify.requireRole('admin', 'superadmin')],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          from:     { type: 'string', format: 'date-time' },
          to:       { type: 'string', format: 'date-time' },
          branchId: { type: 'string' },
        },
      },
    },
  }, async (_request, reply) => {
    return reply.sendEncrypted({
      newUsers:          0,
      returningUsers:    0,
      churnRate:         0,
      retentionRate:     0,
      avgOrdersPerUser:  0,
      topSpenders:       [],
      generatedAt:       new Date().toISOString(),
    }, ENC_LEVEL);
  });

  // ── Branch comparison ─────────────────────────────────────────────────────────
  fastify.get('/branches', {
    preHandler: [fastify.requireRole('admin', 'superadmin')],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          from:   { type: 'string', format: 'date-time' },
          to:     { type: 'string', format: 'date-time' },
          metric: { type: 'string', enum: ['revenue', 'orders', 'users', 'aov'], default: 'revenue' },
        },
      },
    },
  }, async (request, reply) => {
    const { metric = 'revenue' } = request.query;
    return reply.sendEncrypted({
      metric,
      branches:    [],
      leader:      null,
      generatedAt: new Date().toISOString(),
    }, ENC_LEVEL);
  });

  // ── Single branch deep-dive ───────────────────────────────────────────────────
  fastify.get('/branches/:id', {
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
    const u = request.user;
    if (u.role === 'seller' && u.branchId !== request.params.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    return reply.sendEncrypted({
      branchId:       request.params.id,
      revenue:        0,
      orders:         0,
      users:          0,
      topProducts:    [],
      recentOrders:   [],
      stockAlerts:    [],
      generatedAt:    new Date().toISOString(),
    }, ENC_LEVEL);
  });
}

module.exports = analyticsRoutes;
