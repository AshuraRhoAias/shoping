'use strict';

/**
 * Admin / seller / staff routes – all responses encrypted at LEVEL 5 (admin).
 *
 * GET    /api/v1/admin/dashboard   – KPIs across all branches
 * GET    /api/v1/admin/users       – all users with sensitive fields
 * POST   /api/v1/admin/users/:id/role – change role
 * GET    /api/v1/admin/audit       – audit log
 * POST   /api/v1/admin/branch-token – issue a branch-scoped JWT
 * GET    /api/v1/admin/config      – system configuration
 * PUT    /api/v1/admin/config      – update system configuration
 */
async function adminRoutes(fastify) {
  const ENC_LEVEL = 'admin'; // 5-layer encryption

  // Only admin / superadmin / seller can access this prefix
  fastify.addHook('preHandler', fastify.requireRole('admin', 'superadmin', 'seller'));

  // ── Dashboard KPIs ───────────────────────────────────────────────────────────
  fastify.get('/dashboard', async (request, reply) => {
    // Placeholder – aggregate from DB across all branches
    const kpis = {
      totalRevenue:   0,
      totalOrders:    0,
      totalUsers:     0,
      activeBranches: 0,
      revenueByBranch: [],
      topProducts:    [],
      generatedAt:    new Date().toISOString(),
    };
    return reply.sendEncrypted(kpis, ENC_LEVEL);
  });

  // ── List all users with sensitive fields ─────────────────────────────────────
  fastify.get('/users', {
    preHandler: [fastify.requireRole('admin', 'superadmin')],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page:     { type: 'integer', minimum: 1, default: 1 },
          limit:    { type: 'integer', minimum: 1, maximum: 500, default: 100 },
          branchId: { type: 'string' },
          role:     { type: 'string' },
          search:   { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { page = 1, limit = 100 } = request.query;
    // Placeholder
    return reply.sendEncrypted({ users: [], total: 0, page, limit }, ENC_LEVEL);
  });

  // ── Change user role ─────────────────────────────────────────────────────────
  fastify.post('/users/:id/role', {
    preHandler: [fastify.requireRole('superadmin')],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['role'],
        properties: {
          role: {
            type: 'string',
            enum: ['user', 'seller', 'admin', 'superadmin'],
          },
          branchId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id }       = request.params;
    const { role, branchId } = request.body;
    // Placeholder – update in DB
    return reply.sendEncrypted(
      { id, role, branchId, updatedAt: new Date().toISOString() },
      ENC_LEVEL,
    );
  });

  // ── Audit log ────────────────────────────────────────────────────────────────
  fastify.get('/audit', {
    preHandler: [fastify.requireRole('admin', 'superadmin')],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page:     { type: 'integer', minimum: 1, default: 1 },
          limit:    { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          userId:   { type: 'string' },
          action:   { type: 'string' },
          from:     { type: 'string', format: 'date-time' },
          to:       { type: 'string', format: 'date-time' },
        },
      },
    },
  }, async (request, reply) => {
    const { page = 1, limit = 50 } = request.query;
    // Placeholder – query audit log table
    return reply.sendEncrypted({ entries: [], total: 0, page, limit }, ENC_LEVEL);
  });

  // ── Issue branch-scoped JWT ───────────────────────────────────────────────────
  fastify.post('/branch-token', {
    preHandler: [fastify.requireRole('admin', 'superadmin')],
    schema: {
      body: {
        type: 'object',
        required: ['branchId'],
        properties: {
          branchId: { type: 'string' },
          ttl:      { type: 'string', default: '24h' },
        },
      },
    },
  }, async (request, reply) => {
    const { branchId } = request.body;
    const token = await reply.branchSign({
      sub: request.user.sub,
      role: request.user.role,
      branchId,
    });
    return reply.sendEncrypted({ branchToken: token, branchId }, ENC_LEVEL);
  });

  // ── System configuration ─────────────────────────────────────────────────────
  const systemConfig = {
    maintenanceMode: false,
    maxOrderAmount: 100000,
    allowedPaymentMethods: ['cash', 'card', 'transfer'],
    taxRate: 0.16,
  };

  fastify.get('/config', {
    preHandler: [fastify.requireRole('superadmin')],
  }, async (_request, reply) => {
    return reply.sendEncrypted({ config: systemConfig }, ENC_LEVEL);
  });

  fastify.put('/config', {
    preHandler: [fastify.requireRole('superadmin')],
    schema: {
      body: {
        type: 'object',
        properties: {
          maintenanceMode:        { type: 'boolean' },
          maxOrderAmount:         { type: 'number', minimum: 0 },
          allowedPaymentMethods:  { type: 'array', items: { type: 'string' } },
          taxRate:                { type: 'number', minimum: 0, maximum: 1 },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    Object.assign(systemConfig, request.body);
    return reply.sendEncrypted({ config: systemConfig }, ENC_LEVEL);
  });
}

module.exports = adminRoutes;
