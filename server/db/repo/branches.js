'use strict';

function toBranch(row) {
  if (!row) return null;
  return {
    id:        row.id,
    name:      row.name,
    address:   row.address,
    phone:     row.phone,
    timezone:  row.timezone,
    active:    Boolean(row.active),
    metadata:  row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function list(db, { page = 1, limit = 50, active } = {}) {
  const conditions = [];
  const params     = [];
  let   i          = 1;

  if (active !== undefined) { conditions.push(`active = $${i++}`); params.push(active); }

  const where  = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const offset = (page - 1) * limit;

  const [{ rows }, countRes] = await Promise.all([
    db.query(`SELECT * FROM branches ${where} ORDER BY name ASC LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]),
    db.query(`SELECT COUNT(*) AS total FROM branches ${where}`, params),
  ]);

  return {
    branches: rows.map(toBranch),
    total:    Number(countRes.rows[0]?.total || countRes.rows[0]?.['COUNT(*)'] || 0),
  };
}

async function findById(db, id) {
  const { rows } = await db.query('SELECT * FROM branches WHERE id = $1 LIMIT 1', [id]);
  return toBranch(rows[0]);
}

async function create(db, { name, address, phone, timezone = 'UTC', active = true, metadata = null }) {
  const { rows } = await db.query(
    `INSERT INTO branches (name, address, phone, timezone, active, metadata)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [name, address, phone, timezone, active, metadata ? JSON.stringify(metadata) : null],
  );
  return toBranch(rows[0]);
}

async function update(db, id, fields) {
  const allowed = { name: 'name', address: 'address', phone: 'phone', timezone: 'timezone', active: 'active', metadata: 'metadata' };
  const sets  = [];
  const vals  = [];
  let   idx   = 1;

  for (const [k, v] of Object.entries(fields)) {
    const col = allowed[k];
    if (col) { sets.push(`${col} = $${idx++}`); vals.push(k === 'metadata' ? JSON.stringify(v) : v); }
  }
  if (!sets.length) return findById(db, id);

  vals.push(id);
  const { rows } = await db.query(
    `UPDATE branches SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals,
  );
  return toBranch(rows[0]);
}

async function deactivate(db, id) {
  const { rows } = await db.query(
    `UPDATE branches SET active = FALSE WHERE id = $1 RETURNING *`, [id],
  );
  return toBranch(rows[0]);
}

async function summary(db) {
  const { rows } = await db.query(`
    SELECT
      b.id, b.name, b.active,
      COALESCE(SUM(o.total), 0)    AS revenue,
      COUNT(DISTINCT o.id)         AS orders,
      COALESCE(SUM(i.quantity), 0) AS stock
    FROM branches b
    LEFT JOIN orders           o ON o.branch_id = b.id
                                AND o.status NOT IN ('cancelled','refunded')
    LEFT JOIN branch_inventory i ON i.branch_id = b.id
    GROUP BY b.id, b.name, b.active
    ORDER BY b.name
  `);
  return rows.map(r => ({
    id:      r.id,
    name:    r.name,
    active:  Boolean(r.active),
    revenue: Number(r.revenue),
    orders:  Number(r.orders),
    stock:   Number(r.stock),
  }));
}

async function inventory(db, branchId, { page = 1, limit = 100, lowStock } = {}) {
  const conditions = ['i.branch_id = $1'];
  const params     = [branchId];
  let   i          = 2;

  if (lowStock) { conditions.push(`i.quantity < 10`); }

  const where  = 'WHERE ' + conditions.join(' AND ');
  const offset = (page - 1) * limit;

  const [{ rows }, countRes] = await Promise.all([
    db.query(
      `SELECT i.*, p.name, p.sku, p.price FROM branch_inventory i
       JOIN products p ON p.id = i.product_id
       ${where} ORDER BY p.name ASC LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset],
    ),
    db.query(`SELECT COUNT(*) AS total FROM branch_inventory i ${where}`, params),
  ]);

  return {
    inventory: rows.map(r => ({
      id:          r.id,
      branchId:    r.branch_id,
      productId:   r.product_id,
      productName: r.name,
      sku:         r.sku,
      price:       Number(r.price),
      quantity:    r.quantity,
      updatedAt:   r.updated_at,
    })),
    total: Number(countRes.rows[0]?.total || countRes.rows[0]?.['COUNT(*)'] || 0),
  };
}

module.exports = { list, findById, create, update, deactivate, summary, inventory };
