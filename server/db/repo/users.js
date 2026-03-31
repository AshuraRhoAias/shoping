'use strict';

/**
 * Repositorio de usuarios.
 * Todas las funciones reciben el pool `db` como primer argumento
 * para facilitar inyección en tests.
 */

const crypto = require('node:crypto');

// ── helpers ───────────────────────────────────────────────────────────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const derived      = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

// Normaliza fila de DB (snake_case → camelCase) y oculta password_hash
function toUser(row) {
  if (!row) return null;
  const { password_hash, ...r } = row;
  return {
    id:           r.id,
    name:         r.name,
    email:        r.email,
    role:         r.role,
    branchId:     r.branch_id,
    active:       Boolean(r.active),
    createdAt:    r.created_at,
    updatedAt:    r.updated_at,
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

async function findByEmail(db, email) {
  const { rows } = await db.query(
    'SELECT * FROM users WHERE email = $1 LIMIT 1', [email],
  );
  return rows[0] || null;
}

async function findById(db, id) {
  const { rows } = await db.query(
    'SELECT * FROM users WHERE id = $1 LIMIT 1', [id],
  );
  return rows[0] || null;
}

async function create(db, { name, email, password, role = 'user', branchId = null }) {
  const passwordHash = hashPassword(password);
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash, role, branch_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, email, passwordHash, role, branchId],
  );
  return toUser(rows[0]);
}

async function update(db, id, fields) {
  const allowed = ['name', 'email', 'role', 'branch_id', 'active'];
  const sets    = [];
  const vals    = [];
  let   idx     = 1;

  // map camelCase → snake_case
  const map = { branchId: 'branch_id' };
  for (const [k, v] of Object.entries(fields)) {
    const col = map[k] || k;
    if (allowed.includes(col)) {
      sets.push(`${col} = $${idx++}`);
      vals.push(v);
    }
  }
  if (!sets.length) return findById(db, id).then(toUser);

  vals.push(id);
  const { rows } = await db.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    vals,
  );
  return toUser(rows[0]);
}

async function remove(db, id) {
  await db.query('UPDATE users SET active = FALSE WHERE id = $1', [id]);
}

async function list(db, { page = 1, limit = 50, role, branchId } = {}) {
  const conditions = ['active = TRUE'];
  const params     = [];
  let   i          = 1;

  if (role)     { conditions.push(`role = $${i++}`);      params.push(role); }
  if (branchId) { conditions.push(`branch_id = $${i++}`); params.push(branchId); }

  const where  = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const offset = (page - 1) * limit;

  const [{ rows }, countRes] = await Promise.all([
    db.query(`SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]),
    db.query(`SELECT COUNT(*) AS total FROM users ${where}`, params),
  ]);

  return {
    users: rows.map(toUser),
    total: Number(countRes.rows[0]?.total || countRes.rows[0]?.['COUNT(*)'] || 0),
  };
}

async function changeRole(db, id, role, branchId) {
  const { rows } = await db.query(
    'UPDATE users SET role = $1, branch_id = $2 WHERE id = $3 RETURNING *',
    [role, branchId || null, id],
  );
  return toUser(rows[0]);
}

module.exports = { findByEmail, findById, create, update, remove, list, changeRole, hashPassword, verifyPassword, toUser };
