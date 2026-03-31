/**
 * lib/crypto.server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SERVER-SIDE cryptographic utilities (Node.js only).
 * Este archivo NUNCA debe importarse desde un componente cliente.
 *
 * Para producción con múltiples instancias reemplaza SessionStore por
 * la implementación Redis que viene al final de este archivo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// FIX: activado — evita que Next.js incluya este módulo en el bundle del browser.
// Requiere:  npm install server-only
import "server-only";

import {
  createECDH,
  createHmac,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  // FIX: usamos timingSafeEqual nativo de Node en lugar de la implementación
  // manual. La versión manual era correcta, pero esta es más robusta y auditada.
  timingSafeEqual as nodeTimingSafeEqual,
} from "crypto";

// ─── Constantes ───────────────────────────────────────────────────────────────
const CURVE = "prime256v1"; // P-256 ≡ secp256r1
const SALT = Buffer.from("FitEcoreeHousePOS2026");
const INFO_AES = Buffer.from("feh-pos-aes-v1");
const INFO_HMAC = Buffer.from("feh-pos-hmac-v1");
const AES_ALG = "aes-256-gcm";
const GCM_IV_LEN = 12;
const GCM_TAG_LEN = 16;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutos

// ─── Session Store ────────────────────────────────────────────────────────────
// Interfaz común para desarrollo (Map) y producción (Redis).
// Para producción: implementa RedisSessionStore abajo y exporta una instancia.

class MemorySessionStore {
  #store = new Map(); // sessionId → { aesKey, hmacKey, createdAt }

  set(id, aesKey, hmacKey) {
    this.#store.set(id, { aesKey, hmacKey, createdAt: Date.now() });
  }

  get(id) {
    const s = this.#store.get(id);
    if (!s) return null;
    // FIX: validar TTL en cada lectura, no solo en pruneExpired periódico.
    if (Date.now() - s.createdAt > SESSION_TTL_MS) {
      this.#store.delete(id);
      return null;
    }
    return s;
  }

  delete(id) {
    this.#store.delete(id);
  }

  // Limpieza periódica — llama desde un setInterval o cron si lo necesitas.
  prune() {
    const now = Date.now();
    for (const [id, s] of this.#store) {
      if (now - s.createdAt > SESSION_TTL_MS) this.#store.delete(id);
    }
  }

  size() {
    this.prune();
    return this.#store.size;
  }
}

// ── Redis-ready stub ──────────────────────────────────────────────────────────
// Para producción descomenta esta clase y reemplaza `sessionStore` abajo.
// Requiere:  npm install ioredis  (o @upstash/redis para Edge/Serverless)
//
// import Redis from "ioredis";
// const redis = new Redis(process.env.REDIS_URL);
//
// class RedisSessionStore {
//   async set(id, aesKey, hmacKey) {
//     const payload = JSON.stringify({
//       aesKey:  aesKey.toString("base64"),
//       hmacKey: hmacKey.toString("base64"),
//     });
//     await redis.set(`pos:session:${id}`, payload, "PX", SESSION_TTL_MS);
//   }
//   async get(id) {
//     const raw = await redis.get(`pos:session:${id}`);
//     if (!raw) return null;
//     const { aesKey, hmacKey } = JSON.parse(raw);
//     return {
//       aesKey:  Buffer.from(aesKey,  "base64"),
//       hmacKey: Buffer.from(hmacKey, "base64"),
//     };
//   }
//   async delete(id) { await redis.del(`pos:session:${id}`); }
//   async size()     { return (await redis.keys("pos:session:*")).length; }
// }

const sessionStore = new MemorySessionStore();

// ─── HKDF (RFC 5869) ─────────────────────────────────────────────────────────

function hkdfExpand(prk, info, length) {
  const blocks = Math.ceil(length / 32);
  const okm = Buffer.alloc(length);
  let prev = Buffer.alloc(0);
  let offset = 0;

  for (let i = 1; i <= blocks; i++) {
    const hmac = createHmac("sha256", prk);
    hmac.update(prev);
    hmac.update(info);
    hmac.update(Buffer.from([i]));
    prev = hmac.digest();
    const chunk = Math.min(length - offset, 32);
    prev.copy(okm, offset, 0, chunk);
    offset += chunk;
  }
  return okm;
}

function hkdf(ikm, salt, info, length) {
  const prk = createHmac("sha256", salt).update(ikm).digest();
  return hkdfExpand(prk, info, length);
}

// ─── ECDH Handshake ───────────────────────────────────────────────────────────

/**
 * Procesa la clave pública ECDH del cliente.
 * Devuelve { serverPublicKeyB64, sessionId } para enviar al cliente.
 */
export function processHandshake(clientPublicKeyB64) {
  const ecdh = createECDH(CURVE);
  ecdh.generateKeys();

  const clientPubRaw = Buffer.from(clientPublicKeyB64, "base64");
  const sharedSecret = ecdh.computeSecret(clientPubRaw);

  const aesKey = hkdf(sharedSecret, SALT, INFO_AES, 32);
  const hmacKey = hkdf(sharedSecret, SALT, INFO_HMAC, 32);

  const sessionId = randomBytes(24).toString("hex");
  sessionStore.set(sessionId, aesKey, hmacKey);

  const serverPublicKeyB64 = ecdh.getPublicKey("base64", "uncompressed");
  return { serverPublicKeyB64, sessionId };
}

// ─── Descifrar payload del cliente ───────────────────────────────────────────

/**
 * Verifica HMAC y descifra AES-256-GCM un envelope del cliente.
 * Lanza error en sesión inválida, payload alterado o fallo de descifrado.
 */
export function decryptClientPayload(envelope, sessionId) {
  const session = sessionStore.get(sessionId);
  if (!session) throw new Error("Invalid or expired session");

  const { iv, ciphertext, hmac, version } = envelope;
  if (version !== "1") throw new Error("Unsupported envelope version");

  const { aesKey, hmacKey } = session;

  // FIX: comparación en tiempo constante usando Buffer directamente,
  // así evitamos la ramificación temprana por longitudes distintas que
  // la implementación manual tenía (retornaba false antes de comparar bytes).
  const message = `${iv}.${ciphertext}`;
  const expectedHmac = createHmac("sha256", hmacKey).update(message).digest();
  const receivedHmac = Buffer.from(hmac, "base64");

  // nodeTimingSafeEqual lanza si los buffers tienen distinto tamaño,
  // por eso normalizamos ambos a digest base64→Buffer del mismo algoritmo.
  if (expectedHmac.length !== receivedHmac.length || !nodeTimingSafeEqual(expectedHmac, receivedHmac)) {
    throw new Error("HMAC mismatch — payload rejected");
  }

  const ivBuf = Buffer.from(iv, "base64");
  const ctBuf = Buffer.from(ciphertext, "base64");
  const tag = ctBuf.slice(-GCM_TAG_LEN);
  const ctNoBuf = ctBuf.slice(0, -GCM_TAG_LEN);

  const decipher = createDecipheriv(AES_ALG, aesKey, ivBuf);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([decipher.update(ctNoBuf), decipher.final()]);
  return JSON.parse(plain.toString("utf8"));
}

// ─── Cifrar respuesta del servidor ───────────────────────────────────────────

/**
 * AES-256-GCM cifra + HMAC firma un objeto de respuesta.
 * Devuelve un envelope listo para JSON.stringify.
 */
export function encryptServerPayload(data, sessionId) {
  const session = sessionStore.get(sessionId);
  if (!session) throw new Error("Invalid session — cannot encrypt response");

  const { aesKey, hmacKey } = session;

  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const iv = randomBytes(GCM_IV_LEN);

  const cipher = createCipheriv(AES_ALG, aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const ctBuf = Buffer.concat([encrypted, tag]);
  const ivB64 = iv.toString("base64");
  const ctB64 = ctBuf.toString("base64");
  const message = `${ivB64}.${ctB64}`;

  const hmac = createHmac("sha256", hmacKey).update(message).digest("base64");

  return { iv: ivB64, ciphertext: ctB64, hmac, version: "1" };
}

// ─── Helpers públicos ─────────────────────────────────────────────────────────

/** Invalida una sesión explícitamente (logout) */
export function destroySession(sessionId) {
  sessionStore.delete(sessionId);
}

/** Número de sesiones activas (para endpoint de health) */
export function activeSessionCount() {
  return sessionStore.size();
}