'use strict';

/**
 * Encryption configuration
 *
 * Security levels:
 *  LEVEL_3 (all data)    → AES-256-GCM → ChaCha20-Poly1305 → AES-256-CBC
 *  LEVEL_4 (user/client) → LEVEL_3      → Camellia-256-CBC
 *  LEVEL_5 (admin/staff) → LEVEL_4      → AES-192-GCM
 *
 * All keys are derived from env vars via HKDF-SHA512 so rotating a
 * single master secret rotates every derived key.
 */

const crypto = require('node:crypto');

const MASTER_SECRET = process.env.MASTER_SECRET;
const MASTER_SALT   = process.env.MASTER_SALT;

if (!MASTER_SECRET || !MASTER_SALT) {
  throw new Error('MASTER_SECRET and MASTER_SALT env vars are required');
}

/**
 * Derive a fixed-length key from the master secret using HKDF-SHA512.
 * @param {string} info   - domain-separation label
 * @param {number} length - key length in bytes
 */
function deriveKey(info, length) {
  const ikm  = Buffer.from(MASTER_SECRET, 'hex');
  const salt = Buffer.from(MASTER_SALT,   'hex');
  return crypto.hkdfSync('sha512', ikm, salt, Buffer.from(info, 'utf8'), length);
}

// ── Derived keys (derived once at startup, never stored to disk) ──────────────

const KEYS = {
  // Layer 1 – AES-256-GCM (32 bytes)
  aes256gcm: deriveKey('layer1:aes256gcm', 32),

  // Layer 2 – ChaCha20-Poly1305 (32 bytes)
  chacha20: deriveKey('layer2:chacha20poly1305', 32),

  // Layer 3 – AES-256-CBC (32 bytes)
  aes256cbc: deriveKey('layer3:aes256cbc', 32),

  // Layer 4 – Camellia-256-CBC (32 bytes) — users/clients
  camellia256: deriveKey('layer4:camellia256cbc', 32),

  // Layer 5 – AES-192-GCM (24 bytes) — admin/seller/staff
  aes192gcm: deriveKey('layer5:aes192gcm', 24),

  // HMAC key for integrity tags on CBC layers
  hmac: deriveKey('integrity:hmac-sha512', 64),
};

// ── Algorithm identifiers expected by Node crypto ────────────────────────────
const ALGOS = {
  aes256gcm:   'aes-256-gcm',
  chacha20:    'chacha20-poly1305',
  aes256cbc:   'aes-256-cbc',
  camellia256: 'camellia-256-cbc',
  aes192gcm:   'aes-192-gcm',
};

// GCM / Poly1305 IV sizes
const IV_SIZES = {
  aes256gcm:   12,
  chacha20:    12,
  aes256cbc:   16,
  camellia256: 16,
  aes192gcm:   12,
};

module.exports = { KEYS, ALGOS, IV_SIZES };
