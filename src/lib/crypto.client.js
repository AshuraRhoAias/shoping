/**
 * lib/crypto.client.js
 * ─────────────────────────────────────────────────────────────────────────────
 * CLIENT-SIDE cryptographic utilities (browser only — Web Crypto API).
 *
 * Strategy:
 *   • AES-256-GCM  →  symmetric encryption of every request/response payload
 *   • HMAC-SHA-256 →  message authentication (tamper detection)
 *   • ECDH P-256   →  ephemeral key-exchange so the AES key is never hardcoded
 *   • Keys are derived per-session; the raw AES key never leaves the browser in plaintext.
 *
 * Flow:
 *   1. Browser generates an ephemeral ECDH key-pair.
 *   2. Sends its public key to POST /api/pos/handshake.
 *   3. Server replies with ITS ephemeral public key.
 *   4. Both sides derive the same 256-bit shared secret (ECDH).
 *   5. Shared secret → HKDF → AES-GCM key + HMAC key.
 *   6. All subsequent API calls encrypt+sign the body with those keys.
 *   7. Server decrypts and verifies; sends back encrypted+signed responses.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const ENC = new TextEncoder();
const DEC = new TextDecoder();

// ─── Low-level helpers ────────────────────────────────────────────────────────

/** ArrayBuffer → Base64 string */
export function bufToB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/** Base64 string → Uint8Array */
export function b64ToBuf(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

/** Generate 12-byte random IV for AES-GCM */
function randomIV() {
  return crypto.getRandomValues(new Uint8Array(12));
}

// ─── ECDH ephemeral key-pair ───────────────────────────────────────────────────

/**
 * Generate a fresh P-256 ECDH key-pair for this session.
 * Returns { publicKeyB64, privateKey (CryptoKey) }
 */
export async function generateECDHPair() {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );

  const rawPub = await crypto.subtle.exportKey("raw", pair.publicKey);
  return {
    publicKey:    pair.publicKey,
    privateKey:   pair.privateKey,
    publicKeyB64: bufToB64(rawPub),
  };
}

/**
 * Import the server's raw P-256 public key (sent as Base64).
 */
export async function importServerPublicKey(serverPubB64) {
  const raw = b64ToBuf(serverPubB64);
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
}

// ─── HKDF key derivation ─────────────────────────────────────────────────────

/**
 * Derive two keys from the ECDH shared secret via HKDF:
 *   • aesKey  → CryptoKey for AES-256-GCM
 *   • hmacKey → CryptoKey for HMAC-SHA-256
 */
export async function deriveSessionKeys(clientPrivKey, serverPubKey) {
  // Step 1: derive raw shared bits
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: serverPubKey },
    clientPrivKey,
    256
  );

  // Step 2: import shared bits as HKDF source
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    sharedBits,
    "HKDF",
    false,
    ["deriveKey", "deriveBits"]
  );

  const INFO_AES  = ENC.encode("feh-pos-aes-v1");
  const INFO_HMAC = ENC.encode("feh-pos-hmac-v1");
  const SALT      = ENC.encode("FitEcoreeHousePOS2026");

  // AES-256-GCM key
  const aesKey = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: SALT, info: INFO_AES },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  // HMAC-SHA-256 key
  const hmacKey = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: SALT, info: INFO_HMAC },
    hkdfKey,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign", "verify"]
  );

  return { aesKey, hmacKey };
}

// ─── Encrypt ─────────────────────────────────────────────────────────────────

/**
 * Encrypt + authenticate an object payload.
 *
 * Returns a plain object safe to JSON.stringify:
 * {
 *   iv:          <Base64 12-byte IV>,
 *   ciphertext:  <Base64 AES-GCM ciphertext>,
 *   hmac:        <Base64 HMAC-SHA-256 over iv+ciphertext>,
 *   version:     "1",
 * }
 */
export async function encryptPayload(data, aesKey, hmacKey) {
  const plaintext = ENC.encode(JSON.stringify(data));
  const iv = randomIV();

  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    plaintext
  );

  const ivB64   = bufToB64(iv);
  const ctB64   = bufToB64(cipherBuf);
  const message = ENC.encode(ivB64 + "." + ctB64);

  const hmacBuf = await crypto.subtle.sign("HMAC", hmacKey, message);

  return {
    iv:         ivB64,
    ciphertext: ctB64,
    hmac:       bufToB64(hmacBuf),
    version:    "1",
  };
}

// ─── Decrypt ─────────────────────────────────────────────────────────────────

/**
 * Verify HMAC then decrypt an envelope returned by the server.
 * Returns the parsed object, or throws on tamper / decryption failure.
 */
export async function decryptPayload(envelope, aesKey, hmacKey) {
  const { iv, ciphertext, hmac, version } = envelope;

  if (version !== "1") throw new Error("Unknown envelope version");

  // Verify HMAC first (authenticate-then-decrypt)
  const message = ENC.encode(iv + "." + ciphertext);
  const valid = await crypto.subtle.verify(
    "HMAC",
    hmacKey,
    b64ToBuf(hmac),
    message
  );
  if (!valid) throw new Error("HMAC verification failed — payload may be tampered");

  // Decrypt
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBuf(iv) },
    aesKey,
    b64ToBuf(ciphertext)
  );

  return JSON.parse(DEC.decode(plainBuf));
}

// ─── Session singleton ────────────────────────────────────────────────────────
// Stored in module scope (cleared on page reload — intentional).

let _session = null; // { aesKey, hmacKey, sessionId }

/**
 * Initialise (or reuse) the encrypted session.
 * Performs ECDH handshake with the server on first call.
 */
export async function getSession(apiBase = "/api/pos") {
  if (_session) return _session;

  const { publicKey, privateKey, publicKeyB64 } = await generateECDHPair();

  const res = await fetch(`${apiBase}/handshake`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ clientPublicKey: publicKeyB64 }),
  });

  if (!res.ok) throw new Error(`Handshake failed: ${res.status}`);

  const { serverPublicKey, sessionId } = await res.json();

  const serverPub = await importServerPublicKey(serverPublicKey);
  const { aesKey, hmacKey } = await deriveSessionKeys(privateKey, serverPub);

  _session = { aesKey, hmacKey, sessionId };
  return _session;
}

/** Clear session (on logout) */
export function clearSession() {
  _session = null;
}
