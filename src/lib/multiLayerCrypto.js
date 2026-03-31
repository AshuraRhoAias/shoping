'use strict';
/**
 * lib/multiLayerCrypto.js  (server-only)
 * Versión de src/ del cifrado multi-capa del servidor.
 * Misma lógica que server/utils/crypto.js pero accesible dentro del
 * boundary de Next.js (src/).
 *
 * Lee las mismas variables de entorno: MASTER_SECRET, MASTER_SALT
 */
import "server-only";
import crypto from "node:crypto";

const MASTER_SECRET = process.env.MASTER_SECRET;
const MASTER_SALT   = process.env.MASTER_SALT;

function deriveKey(info, length) {
  if (!MASTER_SECRET || !MASTER_SALT) return crypto.randomBytes(length); // fallback dev
  const ikm  = Buffer.from(MASTER_SECRET, "hex");
  const salt = Buffer.from(MASTER_SALT,   "hex");
  return crypto.hkdfSync("sha512", ikm, salt, Buffer.from(info, "utf8"), length);
}

const KEYS = {
  aes256gcm:   deriveKey("layer1:aes256gcm",       32),
  chacha20:    deriveKey("layer2:chacha20poly1305", 32),
  aes256cbc:   deriveKey("layer3:aes256cbc",        32),
  camellia256: deriveKey("layer4:camellia256cbc",   32),
  aes192gcm:   deriveKey("layer5:aes192gcm",        24),
  hmac:        deriveKey("integrity:hmac-sha512",   64),
};

const ALGOS    = { aes256gcm:"aes-256-gcm", chacha20:"chacha20-poly1305", aes256cbc:"aes-256-cbc", camellia256:"camellia-256-cbc", aes192gcm:"aes-192-gcm" };
const IV_SIZES = { aes256gcm:12, chacha20:12, aes256cbc:16, camellia256:16, aes192gcm:12 };

function decryptAEAD(algo, key, packed) {
  const ivLen  = IV_SIZES[algo] * 2;
  const tagLen = 32;
  const iv  = Buffer.from(packed.slice(0, ivLen),              "hex");
  const tag = Buffer.from(packed.slice(ivLen, ivLen + tagLen), "hex");
  const ct  = Buffer.from(packed.slice(ivLen + tagLen),        "hex");
  const d   = crypto.createDecipheriv(ALGOS[algo], key, iv, { authTagLength: 16 });
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

function decryptCBC(algo, key, packed) {
  const ivLen   = IV_SIZES[algo] * 2;
  const hmacLen = 128;
  const iv      = Buffer.from(packed.slice(0, ivLen),                 "hex");
  const storedH = Buffer.from(packed.slice(ivLen, ivLen + hmacLen),   "hex");
  const ct      = Buffer.from(packed.slice(ivLen + hmacLen),          "hex");
  const expected = crypto.createHmac("sha512", KEYS.hmac).update(ct).digest();
  if (!crypto.timingSafeEqual(storedH, expected)) throw new Error("Integrity check failed");
  const d = crypto.createDecipheriv(ALGOS[algo], key, iv);
  return Buffer.concat([d.update(ct), d.final()]);
}

function removePublicLayers(packed) {
  let buf = decryptCBC("aes256cbc", KEYS.aes256cbc, packed);
  buf = decryptAEAD("chacha20", KEYS.chacha20, buf.toString("utf8"));
  return decryptAEAD("aes256gcm", KEYS.aes256gcm, buf.toString("utf8"));
}

function removeUserLayers(packed) {
  const step3 = decryptCBC("camellia256", KEYS.camellia256, packed);
  return removePublicLayers(step3.toString("utf8"));
}

function removeAdminLayers(packed) {
  const step4 = decryptAEAD("aes192gcm", KEYS.aes192gcm, packed);
  return removeUserLayers(step4.toString("utf8"));
}

export function decrypt(packed, level = "public") {
  let buf;
  switch (level) {
    case "admin": buf = removeAdminLayers(packed); break;
    case "user":  buf = removeUserLayers(packed);  break;
    default:      buf = removePublicLayers(packed); break;
  }
  return JSON.parse(buf.toString("utf8"));
}
