'use strict';

function toOrder(row) {
  if (!row) return null;
  return {
    id:              row.id,
    userId:          row.user_id,
    branchId:        row.branch_id,
    status:          row.status,
    subtotal:        Number(row.subtotal),
    discount:        Number(row.discount),
    tax:             Number(row.tax),
    total:           Number(row.total),
    paymentMethod:   row.payment_method,
    shippingAddress: row.shipping_address,
    notes:           row.notes,
    cancelReason:    row.cancel_reason,
    cancelledAt:     row.cancelled_at,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
    items:           row.items || [],
  };
}

async function list(db, { page = 1, limit = 50, branchId, status, userId, from, to } = {}) {
  const conditions = [];
  const params     = [];
  let   i          = 1;

  if (branchId) { conditions.push(`o.branch_id = $${i++}`); params.push(branchId); }
  if (status)   { conditions.push(`o.status = $${i++}`);    params.push(status); }
  if (userId)   { conditions.push(`o.user_id = $${i++}`);   params.push(userId); }
  if (from)     { conditions.push(`o.created_at >= $${i++}`); params.push(from); }
  if (to)       { conditions.push(`o.created_at <= $${i++}`); params.push(to); }

  const where  = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const offset = (page - 1) * limit;

  const [{ rows }, countRes] = await Promise.all([
    db.query(`SELECT o.* FROM orders o ${where} ORDER BY o.created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]),
    db.query(`SELECT COUNT(*) AS total FROM orders o ${where}`, params),
  ]);

  return {
    orders: rows.map(toOrder),
    total:  Number(countRes.rows[0]?.total || countRes.rows[0]?.['COUNT(*)'] || 0),
  };
}

async function findById(db, id) {
  const [{ rows: orderRows }, { rows: itemRows }] = await Promise.all([
    db.query('SELECT * FROM orders WHERE id = $1 LIMIT 1', [id]),
    db.query(
      `SELECT oi.*, p.name AS product_name, p.sku
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [id],
    ),
  ]);

  if (!orderRows[0]) return null;
  const order = toOrder(orderRows[0]);
  order.items = itemRows.map(r => ({
    id:          r.id,
    productId:   r.product_id,
    productName: r.product_name,
    sku:         r.sku,
    quantity:    r.quantity,
    unitPrice:   Number(r.unit_price),
    total:       Number(r.total),
  }));
  return order;
}

async function create(db, { userId, branchId, items, shippingAddress, paymentMethod, notes, discount = 0 }) {
  const TAX_RATE = parseFloat(process.env.TAX_RATE || '0.16');

  const subtotal = items.reduce((s, i) => s + (Number(i.unitPrice) || 0) * i.quantity, 0);
  const tax      = (subtotal - discount) * TAX_RATE;
  const total    = subtotal - discount + tax;

  // Insert order + items atomically so a partial failure never leaves
  // an order row without its items.
  return db.transaction(async (tx) => {
    const { rows } = await tx.query(
      `INSERT INTO orders
         (user_id, branch_id, subtotal, discount, tax, total, payment_method, shipping_address, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [userId, branchId, subtotal, discount, tax, total, paymentMethod,
       shippingAddress ? JSON.stringify(shippingAddress) : null, notes || null],
    );

    const order = rows[0];

    for (const item of items) {
      await tx.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
         VALUES ($1,$2,$3,$4)`,
        [order.id, item.productId, item.quantity, Number(item.unitPrice) || 0],
      );
    }

    return findById(db, order.id);
  });
}

async function updateStatus(db, id, status, comment) {
  const { rows } = await db.query(
    `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`, [status, id],
  );
  return toOrder(rows[0]);
}

async function cancel(db, id, reason) {
  const { rows } = await db.query(
    `UPDATE orders SET status = 'cancelled', cancel_reason = $1, cancelled_at = NOW()
     WHERE id = $2 RETURNING *`,
    [reason || null, id],
  );
  return toOrder(rows[0]);
}

module.exports = { list, findById, create, updateStatus, cancel };
