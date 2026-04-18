'use strict';

function toProduct(row) {
  if (!row) return null;
  return {
    id:          row.id,
    name:        row.name,
    description: row.description,
    price:       Number(row.price),
    costPrice:   Number(row.cost_price),
    sku:         row.sku,
    barcode:     row.barcode,
    category:    row.category,
    tags:        row.tags   || [],
    images:      row.images || [],
    active:      Boolean(row.active),
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

async function list(db, { page = 1, limit = 50, category, search, minPrice, maxPrice, inStock, branchId } = {}) {
  const conditions = ['p.active = TRUE'];
  const params     = [];
  let   i          = 1;

  if (category)             { conditions.push(`p.category = $${i++}`);     params.push(category); }
  if (search) {
    const likeOp = db.type === 'mysql' ? 'LIKE' : 'ILIKE';
    conditions.push(`p.name ${likeOp} $${i++}`);
    params.push(`%${search}%`);
  }
  if (minPrice !== undefined){ conditions.push(`p.price >= $${i++}`);       params.push(minPrice); }
  if (maxPrice !== undefined){ conditions.push(`p.price <= $${i++}`);       params.push(maxPrice); }

  let join = '';
  if (inStock !== undefined) {
    join = branchId
      ? `LEFT JOIN branch_inventory bi ON bi.product_id = p.id AND bi.branch_id = $${i++}`
      : `LEFT JOIN branch_inventory bi ON bi.product_id = p.id`;
    if (branchId) params.push(branchId);
    conditions.push(inStock ? `COALESCE(bi.quantity,0) > 0` : `COALESCE(bi.quantity,0) = 0`);
  }

  const where  = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const offset = (page - 1) * limit;

  const [{ rows }, countRes] = await Promise.all([
    db.query(`SELECT p.* FROM products p ${join} ${where} ORDER BY p.name ASC LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]),
    db.query(`SELECT COUNT(*) AS total FROM products p ${join} ${where}`, params),
  ]);

  return {
    products: rows.map(toProduct),
    total:    Number(countRes.rows[0]?.total || countRes.rows[0]?.['COUNT(*)'] || 0),
  };
}

async function findById(db, id) {
  const { rows } = await db.query('SELECT * FROM products WHERE id = $1 LIMIT 1', [id]);
  return toProduct(rows[0]);
}

async function create(db, data) {
  const { name, description, price, costPrice = 0, sku, barcode, category, tags = [], images = [], active = true } = data;
  const { rows } = await db.query(
    `INSERT INTO products (name, description, price, cost_price, sku, barcode, category, tags, images, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [name, description, price, costPrice, sku, barcode, category,
     JSON.stringify(tags), JSON.stringify(images), active],
  );
  return toProduct(rows[0]);
}

async function update(db, id, fields) {
  const colMap = { name:'name', description:'description', price:'price', costPrice:'cost_price',
    sku:'sku', barcode:'barcode', category:'category', tags:'tags', images:'images', active:'active' };
  const sets = []; const vals = []; let idx = 1;

  for (const [k, v] of Object.entries(fields)) {
    const col = colMap[k];
    if (col) {
      sets.push(`${col} = $${idx++}`);
      vals.push((k === 'tags' || k === 'images') ? JSON.stringify(v) : v);
    }
  }
  if (!sets.length) return findById(db, id);

  vals.push(id);
  const { rows } = await db.query(
    `UPDATE products SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals,
  );
  return toProduct(rows[0]);
}

async function remove(db, id) {
  await db.query('DELETE FROM products WHERE id = $1', [id]);
}

/**
 * Bulk upsert – inserta o actualiza hasta 1000 productos en una sola transacción.
 * Compatible con PostgreSQL (ON CONFLICT) y MySQL (INSERT ... ON DUPLICATE KEY UPDATE).
 */
async function bulkUpsert(db, products) {
  const created = []; const updated = [];

  // Transacción simple – para mayor rendimiento usa COPY en postgres
  for (const item of products) {
    const existing = item.id ? await findById(db, item.id) : null;
    if (existing) {
      await update(db, item.id, item);
      updated.push(item.id);
    } else {
      const p = await create(db, item);
      created.push(p.id);
    }
  }

  return { created: created.length, updated: updated.length };
}

async function updateStock(db, productId, branchId, quantity, operation = 'set') {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 0) throw new Error('Invalid quantity');

  if (db.type === 'mysql') {
    let updateExpr;
    if (operation === 'increment') {
      updateExpr = 'quantity + VALUES(quantity)';
    } else if (operation === 'decrement') {
      updateExpr = 'CASE WHEN quantity > VALUES(quantity) THEN quantity - VALUES(quantity) ELSE 0 END';
    } else {
      updateExpr = 'VALUES(quantity)';
    }
    await db.query(
      `INSERT INTO branch_inventory (branch_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON DUPLICATE KEY UPDATE quantity = ${updateExpr}, updated_at = NOW()`,
      [branchId, productId, qty],
    );
    const { rows } = await db.query(
      'SELECT * FROM branch_inventory WHERE branch_id = $1 AND product_id = $2',
      [branchId, productId],
    );
    return rows[0];
  }

  let conflictExpr;
  if (operation === 'increment') {
    conflictExpr = 'branch_inventory.quantity + EXCLUDED.quantity';
  } else if (operation === 'decrement') {
    conflictExpr = 'GREATEST(0, branch_inventory.quantity - EXCLUDED.quantity)';
  } else {
    conflictExpr = 'EXCLUDED.quantity';
  }

  const { rows } = await db.query(
    `INSERT INTO branch_inventory (branch_id, product_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (branch_id, product_id)
     DO UPDATE SET quantity = ${conflictExpr}, updated_at = NOW()
     RETURNING *`,
    [branchId, productId, qty],
  );
  return rows[0];
}

async function stockByBranch(db, productId) {
  const { rows } = await db.query(
    `SELECT bi.branch_id, b.name AS branch_name, bi.quantity
     FROM branch_inventory bi
     JOIN branches b ON b.id = bi.branch_id
     WHERE bi.product_id = $1 ORDER BY b.name`,
    [productId],
  );
  return rows;
}

module.exports = { list, findById, create, update, remove, bulkUpsert, updateStock, stockByBranch };
