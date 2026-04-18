'use strict';

const usersRepo = require('../db/repo/users');

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
  fastify.get('/dashboard', async (_request, reply) => {
    const db = fastify.db;
    const n  = (v) => Number(v) || 0;

    const [usersR, ordersR, branchR, byBranchR, topProdR] = await Promise.all([
      db.query('SELECT COUNT(*) AS c FROM users WHERE active = TRUE'),
      db.query(`SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS rev
                FROM orders WHERE status NOT IN ('cancelled','refunded')`),
      db.query('SELECT COUNT(*) AS c FROM branches WHERE active = TRUE'),
      db.query(
        `SELECT b.id, b.name, COALESCE(SUM(o.total),0) AS revenue
         FROM branches b
         LEFT JOIN orders o ON o.branch_id = b.id
                           AND o.status NOT IN ('cancelled','refunded')
         GROUP BY b.id, b.name ORDER BY revenue DESC`,
      ),
      db.query(
        `SELECT p.id, p.name, SUM(oi.quantity) AS qty, COALESCE(SUM(oi.total),0) AS revenue
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         JOIN orders   o ON o.id = oi.order_id
         WHERE o.status NOT IN ('cancelled','refunded')
         GROUP BY p.id, p.name ORDER BY revenue DESC LIMIT 5`,
      ),
    ]);

    const agg  = ordersR.rows[0] ?? {};
    return reply.sendEncrypted({
      totalRevenue:   n(agg.rev),
      totalOrders:    n(agg.c),
      totalUsers:     n((usersR.rows[0] ?? {}).c),
      activeBranches: n((branchR.rows[0] ?? {}).c),
      revenueByBranch: byBranchR.rows.map(r => ({
        id:      r.id,
        name:    r.name,
        revenue: n(r.revenue),
      })),
      topProducts: topProdR.rows.map(r => ({
        id:      r.id,
        name:    r.name,
        qty:     n(r.qty),
        revenue: n(r.revenue),
      })),
      generatedAt: new Date().toISOString(),
    }, ENC_LEVEL);
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
    const { page = 1, limit = 100, branchId, role } = request.query;
    const result = await usersRepo.list(fastify.db, { page, limit, branchId, role });
    reply.header('X-Total-Count', String(result.total));
    return reply.sendEncrypted({ ...result, page, limit }, ENC_LEVEL);
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
    const { id }             = request.params;
    const { role, branchId } = request.body;
    const updated = await usersRepo.changeRole(fastify.db, id, role, branchId);
    if (!updated) return reply.code(404).send({ error: 'Not Found' });
    return reply.sendEncrypted({ user: updated }, ENC_LEVEL);
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
    const db = fastify.db;
    const { page = 1, limit = 50, userId, action, from, to } = request.query;

    const conds  = [];
    const params = [];
    let   i      = 1;
    if (userId) { conds.push(`al.user_id = $${i++}`);    params.push(userId); }
    if (action) { conds.push(`al.action = $${i++}`);     params.push(action); }
    if (from)   { conds.push(`al.created_at >= $${i++}`); params.push(from); }
    if (to)     { conds.push(`al.created_at <= $${i++}`); params.push(to); }

    const where  = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const offset = (page - 1) * limit;

    const [{ rows }, countRes] = await Promise.all([
      db.query(
        `SELECT al.*, u.name AS user_name, u.email AS user_email
         FROM audit_log al
         LEFT JOIN users u ON u.id = al.user_id
         ${where} ORDER BY al.created_at DESC LIMIT $${i++} OFFSET $${i++}`,
        [...params, limit, offset],
      ),
      db.query(`SELECT COUNT(*) AS total FROM audit_log al ${where}`, params),
    ]);

    const total   = Number(countRes.rows[0]?.total || countRes.rows[0]?.['COUNT(*)'] || 0);
    const entries = rows.map(r => ({
      id:        r.id,
      userId:    r.user_id,
      userName:  r.user_name,
      userEmail: r.user_email,
      action:    r.action,
      entity:    r.entity,
      entityId:  r.entity_id,
      payload:   r.payload,
      ip:        r.ip,
      createdAt: r.created_at,
    }));

    return reply.sendEncrypted({ entries, total, page, limit }, ENC_LEVEL);
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
