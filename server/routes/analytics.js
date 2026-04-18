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
  const ENC_LEVEL = 'admin';

  fastify.addHook('preHandler', fastify.requireRole('admin', 'superadmin', 'seller'));

  const n = (v) => Number(v) || 0;
  const today = () => new Date().toISOString().split('T')[0];

  // Returns a DB-appropriate expression to truncate created_at to a given granularity
  function granExpr(gran, db) {
    if (db.type === 'mysql') {
      switch (gran) {
        case 'hour':  return "DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00')";
        case 'week':  return "DATE_FORMAT(DATE_SUB(created_at, INTERVAL WEEKDAY(created_at) DAY), '%Y-%m-%d')";
        case 'month': return "DATE_FORMAT(created_at, '%Y-%m-01')";
        default:      return 'DATE(created_at)';
      }
    }
    switch (gran) {
      case 'hour':  return "TO_CHAR(DATE_TRUNC('hour',  created_at), 'YYYY-MM-DD HH24:MI:SS')";
      case 'week':  return "TO_CHAR(DATE_TRUNC('week',  created_at)::date, 'YYYY-MM-DD')";
      case 'month': return "TO_CHAR(DATE_TRUNC('month', created_at)::date, 'YYYY-MM-DD')";
      default:      return "TO_CHAR(created_at::date, 'YYYY-MM-DD')";
    }
  }

  // ── Global overview ───────────────────────────────────────────────────────────
  fastify.get('/overview', async (request, reply) => {
    const db  = fastify.db;
    const u   = request.user;
    const bP  = u.role === 'seller' ? [u.branchId] : [];
    const bC  = u.role === 'seller' ? ' AND branch_id = $1' : '';
    const nxt = bP.length + 1;

    const [usersR, prodsR, branchR, ordersR, todayR] = await Promise.all([
      db.query('SELECT COUNT(*) AS c FROM users WHERE active = TRUE'),
      db.query('SELECT COUNT(*) AS c FROM products WHERE active = TRUE'),
      db.query('SELECT COUNT(*) AS c FROM branches WHERE active = TRUE'),
      db.query(
        `SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS rev
         FROM orders WHERE status NOT IN ('cancelled','refunded')${bC}`,
        bP,
      ),
      db.query(
        `SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS rev
         FROM orders WHERE DATE(created_at) = $${nxt}
           AND status NOT IN ('cancelled','refunded')${bC}`,
        [...bP, today()],
      ),
    ]);

    const agg         = ordersR.rows[0] ?? {};
    const tod         = todayR.rows[0] ?? {};
    const totalOrders = n(agg.c);

    return reply.sendEncrypted({
      totalRevenue:      n(agg.rev),
      totalOrders,
      totalUsers:        n((usersR.rows[0] ?? {}).c),
      totalProducts:     n((prodsR.rows[0] ?? {}).c),
      activeBranches:    n((branchR.rows[0] ?? {}).c),
      ordersToday:       n(tod.c),
      revenueToday:      n(tod.rev),
      conversionRate:    0,
      averageOrderValue: totalOrders > 0 ? n(agg.rev) / totalOrders : 0,
      generatedAt:       new Date().toISOString(),
    }, ENC_LEVEL);
  });

  // ── Revenue breakdown ─────────────────────────────────────────────────────────
  fastify.get('/revenue', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          from:        { type: 'string', format: 'date-time' },
          to:          { type: 'string', format: 'date-time' },
          branchId:    { type: 'string' },
          granularity: { type: 'string', enum: ['hour', 'day', 'week', 'month'], default: 'day' },
        },
      },
    },
  }, async (request, reply) => {
    const db = fastify.db;
    const u  = request.user;
    const { granularity = 'day', from, to } = request.query;
    let { branchId } = request.query;
    if (u.role === 'seller') branchId = u.branchId;

    const conds  = ["status NOT IN ('cancelled','refunded')"];
    const params = [];
    let   i      = 1;
    if (branchId) { conds.push(`branch_id = $${i++}`);   params.push(branchId); }
    if (from)     { conds.push(`created_at >= $${i++}`); params.push(from); }
    if (to)       { conds.push(`created_at <= $${i++}`); params.push(to); }
    const where  = 'WHERE ' + conds.join(' AND ');
    const gExpr  = granExpr(granularity, db);

    // Refunds query with independent param list
    const rConds  = ["status = 'refunded'"];
    const rParams = [];
    let   ri      = 1;
    if (branchId) { rConds.push(`branch_id = $${ri++}`);   rParams.push(branchId); }
    if (from)     { rConds.push(`created_at >= $${ri++}`); rParams.push(from); }
    if (to)       { rConds.push(`created_at <= $${ri++}`); rParams.push(to); }
    const rWhere = 'WHERE ' + rConds.join(' AND ');

    const [seriesR, totalsR, refundsR] = await Promise.all([
      db.query(
        `SELECT ${gExpr} AS period, COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue
         FROM orders ${where} GROUP BY period ORDER BY period ASC`,
        params,
      ),
      db.query(
        `SELECT COALESCE(SUM(total),0) AS revenue, COUNT(*) AS orders FROM orders ${where}`,
        params,
      ),
      db.query(
        `SELECT COALESCE(SUM(total),0) AS refunds FROM orders ${rWhere}`,
        rParams,
      ),
    ]);

    return reply.sendEncrypted({
      granularity,
      branchId:    branchId || 'all',
      series:      seriesR.rows.map(r => ({
        period:  String(r.period),
        orders:  n(r.orders),
        revenue: n(r.revenue),
      })),
      totals: {
        revenue: n((totalsR.rows[0] ?? {}).revenue),
        orders:  n((totalsR.rows[0] ?? {}).orders),
        refunds: n((refundsR.rows[0] ?? {}).refunds),
      },
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
    const db = fastify.db;
    const u  = request.user;
    const { from, to, sort = 'revenue', limit: lim = 20 } = request.query;
    let { branchId } = request.query;
    if (u.role === 'seller') branchId = u.branchId;

    const conds  = ["o.status NOT IN ('cancelled','refunded')"];
    const params = [];
    let   i      = 1;
    if (branchId) { conds.push(`o.branch_id = $${i++}`);   params.push(branchId); }
    if (from)     { conds.push(`o.created_at >= $${i++}`); params.push(from); }
    if (to)       { conds.push(`o.created_at <= $${i++}`); params.push(to); }
    const where  = 'WHERE ' + conds.join(' AND ');
    const sortBy = sort === 'quantity' ? 'total_qty' : 'total_rev';

    const topRes = await db.query(
      `SELECT p.id, p.name, p.sku, p.category,
              SUM(oi.quantity) AS total_qty,
              COALESCE(SUM(oi.total),0) AS total_rev
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN orders   o ON o.id = oi.order_id
       ${where}
       GROUP BY p.id, p.name, p.sku, p.category
       ORDER BY ${sortBy} DESC LIMIT $${i++}`,
      [...params, lim],
    );

    const sConds  = ['bi.quantity < 10', 'p.active = TRUE'];
    const sParams = [];
    let   si      = 1;
    if (branchId) { sConds.push(`bi.branch_id = $${si++}`); sParams.push(branchId); }
    const lowR = await db.query(
      `SELECT p.id, p.name, p.sku, bi.branch_id, b.name AS branch_name, bi.quantity
       FROM branch_inventory bi
       JOIN products  p ON p.id = bi.product_id
       JOIN branches  b ON b.id = bi.branch_id
       WHERE ${sConds.join(' AND ')}
       ORDER BY bi.quantity ASC LIMIT 50`,
      sParams,
    );

    const products = topRes.rows.map(r => ({
      id:       r.id,
      name:     r.name,
      sku:      r.sku,
      category: r.category,
      quantity: n(r.total_qty),
      revenue:  n(r.total_rev),
    }));
    const half = Math.ceil(products.length / 2);

    return reply.sendEncrypted({
      topProducts:    products.slice(0, half),
      bottomProducts: products.slice(half),
      lowStock: lowR.rows.map(r => ({
        id:         r.id,
        name:       r.name,
        sku:        r.sku,
        branchId:   r.branch_id,
        branchName: r.branch_name,
        quantity:   n(r.quantity),
      })),
      generatedAt: new Date().toISOString(),
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
  }, async (request, reply) => {
    const db = fastify.db;
    const { from, to, branchId } = request.query;

    const uConds  = ['active = TRUE'];
    const uParams = [];
    let   ui      = 1;
    if (from) { uConds.push(`created_at >= $${ui++}`); uParams.push(from); }
    if (to)   { uConds.push(`created_at <= $${ui++}`); uParams.push(to); }

    const sConds  = ["o.status NOT IN ('cancelled','refunded')"];
    const sParams = [];
    let   si      = 1;
    if (branchId) { sConds.push(`o.branch_id = $${si++}`);   sParams.push(branchId); }
    if (from)     { sConds.push(`o.created_at >= $${si++}`); sParams.push(from); }
    if (to)       { sConds.push(`o.created_at <= $${si++}`); sParams.push(to); }

    const [newR, retR, topR] = await Promise.all([
      db.query(
        `SELECT COUNT(*) AS c FROM users WHERE ${uConds.join(' AND ')}`,
        uParams,
      ),
      db.query(
        `SELECT COUNT(*) AS c FROM (
           SELECT user_id FROM orders GROUP BY user_id HAVING COUNT(*) > 1
         ) AS repeat_buyers`,
      ),
      db.query(
        `SELECT u.id, u.name, u.email,
                COUNT(o.id) AS orders,
                COALESCE(SUM(o.total),0) AS spent
         FROM orders o JOIN users u ON u.id = o.user_id
         WHERE ${sConds.join(' AND ')}
         GROUP BY u.id, u.name, u.email
         ORDER BY spent DESC LIMIT 10`,
        sParams,
      ),
    ]);

    const newU = n((newR.rows[0] ?? {}).c);
    const retU = n((retR.rows[0] ?? {}).c);

    return reply.sendEncrypted({
      newUsers:         newU,
      returningUsers:   retU,
      churnRate:        0,
      retentionRate:    newU > 0 ? retU / newU : 0,
      avgOrdersPerUser: 0,
      topSpenders: topR.rows.map(r => ({
        id:     r.id,
        name:   r.name,
        email:  r.email,
        orders: n(r.orders),
        spent:  n(r.spent),
      })),
      generatedAt: new Date().toISOString(),
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
    const db = fastify.db;
    const { from, to, metric = 'revenue' } = request.query;

    // Conditions go into the JOIN ON clause so branches with no orders still appear
    const joinConds  = [`o.branch_id = b.id`, "o.status NOT IN ('cancelled','refunded')"];
    const params     = [];
    let   i          = 1;
    if (from) { joinConds.push(`o.created_at >= $${i++}`); params.push(from); }
    if (to)   { joinConds.push(`o.created_at <= $${i++}`); params.push(to); }
    const joinOn = joinConds.join(' AND ');

    const { rows } = await db.query(
      `SELECT b.id, b.name,
              COUNT(DISTINCT o.id)                                            AS orders,
              COALESCE(SUM(o.total), 0)                                       AS revenue,
              COUNT(DISTINCT o.user_id)                                       AS users,
              COALESCE(SUM(o.total) / NULLIF(COUNT(DISTINCT o.id), 0), 0)    AS aov
       FROM branches b
       LEFT JOIN orders o ON ${joinOn}
       GROUP BY b.id, b.name ORDER BY revenue DESC`,
      params,
    );

    const branches = rows.map(r => ({
      id:      r.id,
      name:    r.name,
      orders:  n(r.orders),
      revenue: n(r.revenue),
      users:   n(r.users),
      aov:     n(r.aov),
    }));

    return reply.sendEncrypted({
      metric,
      branches,
      leader:      branches[0] || null,
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
    const db = fastify.db;
    const u  = request.user;
    const { id } = request.params;
    const { from, to } = request.query;

    if (u.role === 'seller' && u.branchId !== id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const conds  = ['o.branch_id = $1', "o.status NOT IN ('cancelled','refunded')"];
    const params = [id];
    let   i      = 2;
    if (from) { conds.push(`o.created_at >= $${i++}`); params.push(from); }
    if (to)   { conds.push(`o.created_at <= $${i++}`); params.push(to); }
    const where = 'WHERE ' + conds.join(' AND ');

    const [kpiR, topProdR, recentR, stockR] = await Promise.all([
      db.query(
        `SELECT COUNT(DISTINCT o.id) AS orders,
                COALESCE(SUM(o.total),0) AS revenue,
                COUNT(DISTINCT o.user_id) AS users
         FROM orders o ${where}`,
        params,
      ),
      db.query(
        `SELECT p.id, p.name,
                SUM(oi.quantity) AS qty,
                COALESCE(SUM(oi.total),0) AS revenue
         FROM order_items oi
         JOIN orders   o ON o.id = oi.order_id
         JOIN products p ON p.id = oi.product_id
         ${where}
         GROUP BY p.id, p.name ORDER BY revenue DESC LIMIT 10`,
        params,
      ),
      db.query(
        `SELECT o.id, o.status, o.total, o.created_at
         FROM orders o WHERE o.branch_id = $1
         ORDER BY o.created_at DESC LIMIT 10`,
        [id],
      ),
      db.query(
        `SELECT p.id, p.name, bi.quantity
         FROM branch_inventory bi
         JOIN products p ON p.id = bi.product_id
         WHERE bi.branch_id = $1 AND bi.quantity < 10
         ORDER BY bi.quantity ASC LIMIT 20`,
        [id],
      ),
    ]);

    const kpi = kpiR.rows[0] ?? {};
    return reply.sendEncrypted({
      branchId:     id,
      revenue:      n(kpi.revenue),
      orders:       n(kpi.orders),
      users:        n(kpi.users),
      topProducts:  topProdR.rows.map(r => ({
        id:      r.id,
        name:    r.name,
        qty:     n(r.qty),
        revenue: n(r.revenue),
      })),
      recentOrders: recentR.rows.map(r => ({
        id:        r.id,
        status:    r.status,
        total:     n(r.total),
        createdAt: r.created_at,
      })),
      stockAlerts: stockR.rows.map(r => ({
        id:       r.id,
        name:     r.name,
        quantity: n(r.quantity),
      })),
      generatedAt: new Date().toISOString(),
    }, ENC_LEVEL);
  });
}

module.exports = analyticsRoutes;
