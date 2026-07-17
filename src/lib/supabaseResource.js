/**
 * lib/supabaseResource.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Utilidades reutilizables para hablar con Supabase sin repetir el mismo
 * boilerplate CRUD en cada entidad.
 *
 *   - `run(query)`         → ejecuta un query y lanza el error o devuelve `data`.
 *   - `createResource(cfg)`→ genera list/getById/create/update/remove para una
 *                            tabla, aplicando un mapper fila↔objeto de dominio.
 *
 * Cualquier tabla nueva se conecta con ~6 líneas de config en vez de copiar
 * un bloque entero de queries.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { supabase } from "./supabaseClient";

/**
 * Ejecuta un query de Supabase; lanza si hay error, si no devuelve `data`.
 * Elimina el repetido `const { data, error } = await ...; if (error) throw error;`.
 */
export async function run(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Factory de un recurso respaldado por una tabla.
 *
 * @param {object} cfg
 * @param {string} cfg.table                       Nombre de la tabla en Supabase.
 * @param {string} [cfg.pk="id"]                    Columna llave primaria.
 * @param {(row: object) => object} cfg.toRow       Fila de BD → objeto de dominio.
 * @param {(data: object) => object} [cfg.toInsert] Datos de dominio → columnas a insertar.
 * @param {(changes: object) => object} [cfg.toUpdate] Cambios de dominio → columnas a actualizar.
 * @param {{ column: string, ascending: boolean }} [cfg.order] Orden por defecto de `list()`.
 * @returns {{ list, getById, create, update, remove }}
 */
export function createResource(cfg) {
  const { table, pk = "id", toRow, toInsert, toUpdate, order } = cfg;

  return {
    /** Lista filas mapeadas. Acepta paginación `{ page, limit }` y orden opcional. */
    async list({ page, limit, order: ord = order } = {}) {
      let query = supabase.from(table).select("*");
      if (ord) query = query.order(ord.column, { ascending: ord.ascending });
      if (page && limit) {
        const from = (page - 1) * limit;
        query = query.range(from, from + limit - 1);
      }
      const rows = await run(query);
      return (rows || []).map(toRow);
    },

    /** Devuelve una sola fila mapeada por su llave primaria. */
    async getById(id) {
      const row = await run(supabase.from(table).select("*").eq(pk, id).single());
      return toRow(row);
    },

    /** Inserta y devuelve la fila creada, ya mapeada. */
    async create(data) {
      const row = await run(
        supabase.from(table).insert(toInsert ? toInsert(data) : data).select().single()
      );
      return toRow(row);
    },

    /** Actualiza por llave primaria y devuelve la fila mapeada. */
    async update(id, changes) {
      const patch = toUpdate ? toUpdate(changes) : changes;
      const row = await run(
        supabase.from(table).update(patch).eq(pk, id).select().single()
      );
      return toRow(row);
    },

    /** Elimina por llave primaria. */
    async remove(id) {
      await run(supabase.from(table).delete().eq(pk, id));
      return { success: true };
    },
  };
}
