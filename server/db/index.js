'use strict';

/**
 * Fábrica de pool de conexiones.
 * Lee DB_TYPE del entorno y devuelve un objeto uniforme { query, end }.
 *
 * Uso:
 *   const db = require('./db');
 *   const { rows } = await db.query('SELECT * FROM users WHERE id=$1', [id]);
 */

let _pool = null;

function getPool() {
  if (_pool) return _pool;

  const type     = process.env.DB_TYPE     || 'postgres';
  const host     = process.env.DB_HOST     || '127.0.0.1';
  const port     = Number(process.env.DB_PORT) || (type === 'mysql' ? 3306 : 5432);
  const database = process.env.DB_NAME     || 'shopdb';
  const user     = process.env.DB_USER     || 'shopuser';
  const password = process.env.DB_PASSWORD || '';
  const min      = Number(process.env.DB_POOL_MIN) || 2;
  const max      = Number(process.env.DB_POOL_MAX) || 20;

  if (type === 'mysql') {
    const mysql = require('mysql2/promise');
    const pool  = mysql.createPool({ host, port, database, user, password, waitForConnections: true, connectionLimit: max, queueLimit: 0, charset: 'utf8mb4' });

    _pool = {
      /**
       * Normaliza el resultado de mysql2 al mismo shape que pg:
       *   { rows: Array, rowCount: number }
       */
      async query(sql, params = []) {
        // mysql2 usa ? como placeholder; reemplazamos $1,$2,… si vienen del código pg
        const pgStyle = /\$\d+/.test(sql);
        let   finalSql   = sql;
        let   finalParams = params;
        if (pgStyle) {
          let i = 0;
          finalSql = sql.replace(/\$\d+/g, () => { i++; return '?'; });
        }
        const [rows] = await pool.execute(finalSql, finalParams);
        return { rows: Array.isArray(rows) ? rows : [], rowCount: rows.affectedRows ?? rows.length };
      },
      async end() { await pool.end(); },
      type: 'mysql',
    };
  } else {
    const { Pool } = require('pg');
    const pool = new Pool({ host, port, database, user, password, min, max, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });

    pool.on('error', (err) => {
      console.error('[db] Idle client error:', err.message);
    });

    _pool = {
      query:  (sql, params) => pool.query(sql, params),
      end:    ()            => pool.end(),
      type:   'postgres',
    };
  }

  return _pool;
}

module.exports = { getPool };
