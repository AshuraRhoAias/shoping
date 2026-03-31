'use strict';

/**
 * Multi-layer symmetric encryption / decryption.
 *
 * Each layer produces:  IV ‖ [AuthTag (GCM/Poly)] ‖ CipherText   (all hex)
 * The layers are chained: output of layer N is plaintext of layer N+1.
 *
 * Security levels
 * ───────────────
 *   encrypt(data, 'public')  → 3 layers  (all traffic)
 *   encrypt(data, 'user')    → 4 layers  (users / clients)
 *   encrypt(data, 'admin')   → 5 layers  (admin / seller / staff)
 *
 * No external deps – only Node.js built-in `crypto`.
 */

const crypto = require('node:crypto');
const { KEYS, ALGOS, IV_SIZES } = require('../config/encryption');

// ── helpers ────────────────────────────────────────────────────────────────────

/**
 * Authenticated encryption with GCM / Poly1305.
 * Returns:  IV (hex) + AuthTag (hex, 16 bytes) + CipherText (hex)
 */
function encryptAEAD(algo, key, plaintext) {
  const iv     = crypto.randomBytes(IV_SIZES[algo]);
  const cipher = crypto.createCipheriv(ALGOS[algo], key, iv, { authTagLength: 16 });
  const ct     = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return iv.toString('hex') + tag.toString('hex') + ct.toString('hex');
}

function decryptAEAD(algo, key, packed) {
  const ivLen  = IV_SIZES[algo] * 2;          // hex chars
  const tagLen = 32;                           // 16 bytes = 32 hex chars
  const iv     = Buffer.from(packed.slice(0, ivLen),              'hex');
  const tag    = Buffer.from(packed.slice(ivLen, ivLen + tagLen), 'hex');
  const ct     = Buffer.from(packed.slice(ivLen + tagLen),        'hex');
  const decipher = crypto.createDecipheriv(ALGOS[algo], key, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/**
 * CBC encryption + HMAC-SHA512 integrity tag.
 * Returns:  IV (hex) + HMAC (hex, 64 bytes) + CipherText (hex)
 */
function encryptCBC(algo, key, plaintext) {
  const iv     = crypto.randomBytes(IV_SIZES[algo]);
  const cipher = crypto.createCipheriv(ALGOS[algo], key, iv);
  const ct     = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const hmac   = crypto.createHmac('sha512', KEYS.hmac).update(ct).digest();
  return iv.toString('hex') + hmac.toString('hex') + ct.toString('hex');
}

function decryptCBC(algo, key, packed) {
  const ivLen   = IV_SIZES[algo] * 2;
  const hmacLen = 128;                         // 64 bytes = 128 hex chars
  const iv      = Buffer.from(packed.slice(0, ivLen),                 'hex');
  const storedH = Buffer.from(packed.slice(ivLen, ivLen + hmacLen),   'hex');
  const ct      = Buffer.from(packed.slice(ivLen + hmacLen),          'hex');
  const expected = crypto.createHmac('sha512', KEYS.hmac).update(ct).digest();
  if (!crypto.timingSafeEqual(storedH, expected)) {
    throw new Error('Integrity check failed – data may have been tampered with');
  }
  const decipher = crypto.createDecipheriv(ALGOS[algo], key, iv);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

// ── Layer runners ──────────────────────────────────────────────────────────────

/** 3 layers applied in sequence to `data` (Buffer or string → returns string) */
function applyPublicLayers(data) {
  let buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  // Layer 1: AES-256-GCM
  let packed = encryptAEAD('aes256gcm', KEYS.aes256gcm, buf);
  // Layer 2: ChaCha20-Poly1305
  packed = encryptAEAD('chacha20', KEYS.chacha20, Buffer.from(packed, 'utf8'));
  // Layer 3: AES-256-CBC + HMAC
  packed = encryptCBC('aes256cbc', KEYS.aes256cbc, Buffer.from(packed, 'utf8'));
  return packed;
}

function removePublicLayers(packed) {
  // Reverse order
  let buf = decryptCBC('aes256cbc', KEYS.aes256cbc, packed);
  buf = decryptAEAD('chacha20', KEYS.chacha20, buf.toString('utf8'));
  buf = decryptAEAD('aes256gcm', KEYS.aes256gcm, buf.toString('utf8'));
  return buf; // Buffer
}

/** 4 layers: 3 public + Camellia-256-CBC */
function applyUserLayers(data) {
  const step3 = applyPublicLayers(data);
  return encryptCBC('camellia256', KEYS.camellia256, Buffer.from(step3, 'utf8'));
}

function removeUserLayers(packed) {
  const step3 = decryptCBC('camellia256', KEYS.camellia256, packed);
  return removePublicLayers(step3.toString('utf8'));
}

/** 5 layers: 4 user + AES-192-GCM */
function applyAdminLayers(data) {
  const step4 = applyUserLayers(data);
  return encryptAEAD('aes192gcm', KEYS.aes192gcm, Buffer.from(step4, 'utf8'));
}

function removeAdminLayers(packed) {
  const step4 = decryptAEAD('aes192gcm', KEYS.aes192gcm, packed);
  return removeUserLayers(step4.toString('utf8'));
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Encrypt any value.
 * @param {*}      value  - will be JSON-serialised before encryption
 * @param {'public'|'user'|'admin'} level
 * @returns {string} encrypted hex string
 */
function encrypt(value, level = 'public') {
  const json = JSON.stringify(value);
  switch (level) {
    case 'admin':  return applyAdminLayers(json);
    case 'user':   return applyUserLayers(json);
    default:       return applyPublicLayers(json);
  }
}

/**
 * Decrypt a value previously encrypted with `encrypt`.
 * @param {string} packed
 * @param {'public'|'user'|'admin'} level
 * @returns {*} parsed JSON value
 */
function decrypt(packed, level = 'public') {
  let buf;
  switch (level) {
    case 'admin': buf = removeAdminLayers(packed); break;
    case 'user':  buf = removeUserLayers(packed);  break;
    default:      buf = removePublicLayers(packed); break;
  }
  return JSON.parse(buf.toString('utf8'));
}

/**
 * Encrypt a plain object's fields selectively.
 * Fields listed in `sensitiveFields` get the higher level; the rest get `baseLevel`.
 *
 * Example:
 *   encryptObject({ name:'Alice', password:'x', role:'admin' },
 *                 { baseLevel:'user', sensitiveFields:['password'], sensitiveLevel:'admin' })
 */
function encryptObject(obj, { baseLevel = 'public', sensitiveFields = [], sensitiveLevel = 'user' } = {}) {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = sensitiveFields.includes(k)
      ? encrypt(v, sensitiveLevel)
      : encrypt(v, baseLevel);
  }
  return result;
}

/**
 * Decrypt a plain object previously encrypted with `encryptObject`.
 */
function decryptObject(obj, { baseLevel = 'public', sensitiveFields = [], sensitiveLevel = 'user' } = {}) {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = sensitiveFields.includes(k)
      ? decrypt(v, sensitiveLevel)
      : decrypt(v, baseLevel);
  }
  return result;
}

module.exports = { encrypt, decrypt, encryptObject, decryptObject };
