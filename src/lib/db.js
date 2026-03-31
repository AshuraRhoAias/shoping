/**
 * lib/db.js  (server-only)
 * Cliente de base de datos para las rutas POS de Next.js.
 * Usa la misma DB Docker creada por el wizard del servidor Fastify.
 * Provee una API Prisma-like para los modelos usados en /api/pos/.
 *
 * Env vars requeridas (mismas que server/.env, agrégalas a .env.local):
 *   DB_TYPE, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 */
import "server-only";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// ── Pool de conexión ──────────────────────────────────────────────────────────

let _pool = null;

function getPool() {
  if (_pool) return _pool;

  const type     = process.env.DB_TYPE     || "postgres";
  const host     = process.env.DB_HOST     || "127.0.0.1";
  const port     = Number(process.env.DB_PORT) || (type === "mysql" ? 3306 : 5432);
  const database = process.env.DB_NAME     || "shopdb";
  const user     = process.env.DB_USER     || "shopuser";
  const password = process.env.DB_PASSWORD || "";

  if (type === "mysql") {
    const mysql = require("mysql2/promise");
    const pool  = mysql.createPool({ host, port, database, user, password, waitForConnections: true, connectionLimit: 10, charset: "utf8mb4" });
    _pool = {
      type: "mysql",
      async query(sql, params = []) {
        const pgStyle = /\$\d+/.test(sql);
        let finalSql = pgStyle ? sql.replace(/\$\d+/g, () => "?") : sql;
        const [rows] = await pool.execute(finalSql, params);
        return { rows: Array.isArray(rows) ? rows : [], rowCount: rows.affectedRows ?? rows.length };
      },
    };
  } else {
    const { Pool } = require("pg");
    const pool = new Pool({ host, port, database, user, password, max: 10, idleTimeoutMillis: 30_000 });
    _pool = {
      type: "postgres",
      query: (sql, params) => pool.query(sql, params),
    };
  }
  return _pool;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uuid() {
  // crypto is available globally in Node 19+, else import
  return globalThis.crypto?.randomUUID?.() ?? require("node:crypto").randomUUID();
}

function toSnake(str) {
  return str.replace(/[A-Z]/g, c => "_" + c.toLowerCase());
}

/** Convierte objeto camelCase a snake_case para columnas */
function toColumns(data) {
  const cols = {}; const vals = [];
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) { cols[toSnake(k)] = v; vals.push(v); }
  }
  return { cols: Object.keys(cols), vals };
}

/** Resuelve valor especial de Prisma { increment: n } / { decrement: n } */
function resolveValue(val) {
  if (val && typeof val === "object") {
    if ("increment" in val) return { expr: (col) => `${col} + ${Number(val.increment)}`, val: null };
    if ("decrement" in val) return { expr: (col) => `GREATEST(0, ${col} - ${Number(val.decrement)})`, val: null };
  }
  return { expr: null, val };
}

/** Construye WHERE desde { field: value } o { field: { not: null } } */
function buildWhere(where, startIdx = 1) {
  const parts = []; const vals = []; let i = startIdx;
  for (const [k, v] of Object.entries(where)) {
    const col = toSnake(k);
    if (v === null)                          { parts.push(`${col} IS NULL`); }
    else if (v && typeof v === "object" && "not" in v) {
      if (v.not === null) parts.push(`${col} IS NOT NULL`);
      else { parts.push(`${col} != $${i++}`); vals.push(v.not); }
    }
    else { parts.push(`${col} = $${i++}`); vals.push(v); }
  }
  return { clause: parts.length ? "WHERE " + parts.join(" AND ") : "", vals };
}

/** Construye ORDER BY desde { field: "asc"|"desc" } */
function buildOrder(orderBy) {
  if (!orderBy) return "";
  const parts = [];
  for (const [k, dir] of Object.entries(orderBy)) {
    const col = toSnake(k);
    // Whitelist: only alphanumeric and underscores allowed in column names
    if (!/^[a-z_][a-z0-9_]*$/.test(col)) throw new Error(`Invalid column name: ${col}`);
    parts.push(`${col} ${dir === "desc" ? "DESC" : "ASC"}`);
  }
  return parts.length ? "ORDER BY " + parts.join(", ") : "";
}

// ── Model factory ──────────────────────────────────────────────────────────────

function makeModel(tableName) {
  return {

    async findMany({ where, orderBy, select, skip, take, include } = {}) {
      const pool = getPool();
      const { clause, vals } = where ? buildWhere(where) : { clause: "", vals: [] };
      const order  = buildOrder(orderBy);
      const limit  = take  ? `LIMIT ${take}`            : "";
      const offset = skip  ? `OFFSET ${skip}`           : "";
      const cols   = select ? Object.keys(select).map(toSnake).join(", ") : "*";
      const { rows } = await pool.query(
        `SELECT ${cols} FROM ${tableName} ${clause} ${order} ${limit} ${offset}`.trim(),
        vals,
      );
      return rows;
    },

    async findUnique({ where, select } = {}) {
      const pool = getPool();
      const { clause, vals } = buildWhere(where);
      const cols = select ? Object.keys(select).map(toSnake).join(", ") : "*";
      const { rows } = await pool.query(
        `SELECT ${cols} FROM ${tableName} ${clause} LIMIT 1`, vals,
      );
      return rows[0] || null;
    },

    async findFirst({ where, orderBy } = {}) {
      const pool = getPool();
      const { clause, vals } = where ? buildWhere(where) : { clause: "", vals: [] };
      const order = buildOrder(orderBy);
      const { rows } = await pool.query(
        `SELECT * FROM ${tableName} ${clause} ${order} LIMIT 1`.trim(), vals,
      );
      return rows[0] || null;
    },

    async create({ data } = {}) {
      const pool = getPool();
      const id   = uuid();
      const flat = { id, ...data };

      // Handle nested relations like { items: { create: [...] } }
      const nested = {};
      const simple = {};
      for (const [k, v] of Object.entries(flat)) {
        if (v && typeof v === "object" && "create" in v) nested[k] = v.create;
        else simple[k] = v;
      }

      const { cols, vals } = toColumns(simple);
      const placeholders   = vals.map((_, i) => `$${i + 1}`).join(", ");
      await pool.query(
        `INSERT INTO ${tableName} (${cols.join(", ")}) VALUES (${placeholders})`, vals,
      );

      // Insert nested items
      for (const [rel, items] of Object.entries(nested)) {
        const joinTable = `${tableName.replace(/s$/, "")}_items`;
        for (const item of items) {
          const parent  = `${tableName.replace(/s$/, "")}_id`;
          const iFlat   = { id: uuid(), [parent]: id, ...item };
          const { cols: ic, vals: iv } = toColumns(iFlat);
          const ph = iv.map((_, i) => `$${i + 1}`).join(", ");
          await pool.query(`INSERT INTO ${joinTable} (${ic.join(", ")}) VALUES (${ph})`, iv);
        }
      }

      return { id, ...simple };
    },

    async update({ where, data } = {}) {
      const pool = getPool();
      const { clause, vals: whereVals } = buildWhere(where);
      const sets = []; const setVals = []; let i = 1;
      for (const [k, v] of Object.entries(data)) {
        const col = toSnake(k);
        const { expr, val } = resolveValue(v);
        if (expr) sets.push(`${col} = ${expr(col)}`);
        else { sets.push(`${col} = $${i++}`); setVals.push(val); }
      }
      const allVals = [...setVals, ...whereVals.map((_, j) => whereVals[j])];
      // reindex where clause placeholders
      const reindexed = clause.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + setVals.length}`);
      const { rows } = await pool.query(
        `UPDATE ${tableName} SET ${sets.join(", ")} ${reindexed} RETURNING *`,
        allVals,
      );
      return rows[0] || null;
    },

    async updateMany({ where, data } = {}) {
      return this.update({ where, data });
    },

    async delete({ where } = {}) {
      const pool = getPool();
      const { clause, vals } = buildWhere(where);
      await pool.query(`DELETE FROM ${tableName} ${clause}`, vals);
      return { ok: true };
    },

    async aggregate({ where, _sum, _count } = {}) {
      const pool = getPool();
      const { clause, vals } = where ? buildWhere(where) : { clause: "", vals: [] };

      const selectParts = [];
      if (_count === true) selectParts.push("COUNT(*) AS _count");
      if (_sum && typeof _sum === "object") {
        for (const field of Object.keys(_sum)) {
          selectParts.push(`SUM(${toSnake(field)}) AS _sum_${toSnake(field)}`);
        }
      }
      if (selectParts.length === 0) selectParts.push("COUNT(*) AS _count");

      const { rows } = await pool.query(
        `SELECT ${selectParts.join(", ")} FROM ${tableName} ${clause}`.trim(),
        vals,
      );

      const row = rows[0] || {};
      const result = {};

      if (_count === true) {
        result._count = Number(row._count ?? row["count(*)"] ?? 0);
      }
      if (_sum && typeof _sum === "object") {
        result._sum = {};
        for (const field of Object.keys(_sum)) {
          const col = `_sum_${toSnake(field)}`;
          result._sum[field] = row[col] != null ? Number(row[col]) : null;
        }
      }

      return result;
    },
  };
}

// ── Exported db client ────────────────────────────────────────────────────────

export const db = {
  user:    makeModel("users"),
  product: makeModel("products"),
  sale:    makeModel("pos_sales"),
  ticket:  makeModel("pos_tickets"),
  debtor:  makeModel("pos_debtors"),
  expense: makeModel("pos_expenses"),
};
