/**
 * lib/rateLimit.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Sliding-window rate limiter para rutas API de Next.js.
 *
 * En desarrollo usa un Map en memoria (RateLimitStore).
 * En producción reemplaza por RedisRateLimitStore para que el límite
 * se comparta entre todas las instancias del servidor.
 *
 * Requiere para Redis:  npm install ioredis  (o @upstash/redis)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// FIX: la implementación original usaba un Map global. En producción con
// múltiples instancias o serverless el Map no se comparte, por lo que
// cada instancia tiene su propia ventana y el límite real es max × N instancias.
// Esta versión expone una interfaz común Memory/Redis para cambiar sin tocar
// el código que consume rateLimit().

const WINDOW_MS_DEFAULT = 60_000;
const MAX_DEFAULT = 60;

// ─── Memory store (desarrollo) ───────────────────────────────────────────────

class MemoryRateLimitStore {
  #store = new Map(); // ip → [timestamp, ...]

  /**
   * Registra una petición y devuelve cuántas hay en la ventana.
   * @param {string} key
   * @param {number} windowMs
   * @returns {number} count dentro de la ventana
   */
  hit(key, windowMs) {
    const now = Date.now();
    const hits = (this.#store.get(key) ?? []).filter(t => now - t < windowMs);
    hits.push(now);
    this.#store.set(key, hits);
    return hits.length;
  }
}

// ─── Redis store (producción) ────────────────────────────────────────────────
// Descomenta y reemplaza `store` abajo cuando tengas Redis disponible.
//
// import Redis from "ioredis";   // o: import { Redis } from "@upstash/redis";
// const redis = new Redis(process.env.REDIS_URL);
//
// class RedisRateLimitStore {
//   async hit(key, windowMs) {
//     const rkey   = `rl:${key}`;
//     const now    = Date.now();
//     const cutoff = now - windowMs;
//     const pipe   = redis.pipeline();
//     pipe.zremrangebyscore(rkey, "-inf", cutoff);   // limpia entradas viejas
//     pipe.zadd(rkey, now, `${now}-${Math.random()}`); // agrega esta petición
//     pipe.zcard(rkey);                               // cuenta en ventana
//     pipe.pexpire(rkey, windowMs);                   // TTL automático
//     const results = await pipe.exec();
//     return results[2][1]; // resultado de ZCARD
//   }
// }

const store = new MemoryRateLimitStore();

// ─── Función pública ──────────────────────────────────────────────────────────

/**
 * @param {Request} request
 * @param {{ max?: number, windowMs?: number }} opts
 * @returns {Promise<{ ok: boolean, remaining: number }>}
 */
export async function rateLimit(request, {
  max = MAX_DEFAULT,
  windowMs = WINDOW_MS_DEFAULT,
} = {}) {
  const ip = getIP(request);
  const count = await store.hit(ip, windowMs);
  const ok = count <= max;

  return { ok, remaining: Math.max(0, max - count) };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getIP(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}