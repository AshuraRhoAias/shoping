/**
 * lib/api.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Frontend API service layer.
 *
 * Every call to this module:
 *   1. Ensures a live encrypted session (ECDH handshake if needed).
 *   2. Encrypts the request body with AES-256-GCM + HMAC-SHA-256.
 *   3. Sends the encrypted envelope to the Next.js API route.
 *   4. Receives an encrypted envelope back.
 *   5. Verifies the HMAC then decrypts the response.
 *   6. Returns the plain JS object to the caller.
 *
 * The raw AES/HMAC keys are never serialized to localStorage / cookies.
 * They live only in the JS module closure (in-memory, cleared on reload).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  getSession,
  clearSession,
  encryptPayload,
  decryptPayload,
} from "./crypto.client";

const API_BASE = "/api/pos";

// ─── Core secure fetch ────────────────────────────────────────────────────────

/**
 * Send an encrypted POST/PUT/PATCH/DELETE request and decrypt the response.
 *
 * @param {string} endpoint
 * @param {object} data        — plain JS object; will be encrypted
 * @param {"POST"|"PUT"|"PATCH"|"DELETE"} method
 * @param {boolean} _isRetry   — internal flag to avoid infinite retry loops
 */
async function secureRequest(endpoint, data = {}, method = "POST", _isRetry = false) {
  const { aesKey, hmacKey, sessionId } = await getSession(API_BASE);

  const envelope = await encryptPayload(data, aesKey, hmacKey);

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Session-Id": sessionId,
    },
    credentials: "same-origin",
    body: JSON.stringify(envelope),
  });

  if (res.status === 401 && !_isRetry) {
    // Session expired server-side — clear local session and retry exactly once
    clearSession();
    return secureRequest(endpoint, data, method, true);
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new ApiError(res.status, errorText || "Request failed");
  }

  // FIX: reutilizamos aesKey/hmacKey de la misma sesión que cifró la petición.
  // El original llamaba getSession() de nuevo aquí, lo que podría devolver
  // claves distintas si la sesión rotó entre las dos llamadas.
  const responseEnvelope = await res.json();
  return decryptPayload(responseEnvelope, aesKey, hmacKey);
}

/**
 * Send an encrypted GET request (no body; query-params only).
 *
 * FIX: una sola llamada a getSession() al inicio para garantizar que
 * las claves usadas en descifrado sean exactamente las mismas que
 * corresponden al sessionId enviado en el header.
 */
async function secureGet(endpoint, params = {}, _isRetry = false) {
  const { aesKey, hmacKey, sessionId } = await getSession(API_BASE);

  const qs = new URLSearchParams(params).toString();
  const url = `${API_BASE}${endpoint}${qs ? "?" + qs : ""}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "X-Session-Id": sessionId },
    credentials: "same-origin",
  });

  if (res.status === 401 && !_isRetry) {
    clearSession();
    return secureGet(endpoint, params, true);
  }

  if (!res.ok) throw new ApiError(res.status, "GET request failed");

  const envelope = await res.json();
  return decryptPayload(envelope, aesKey, hmacKey);
}

// ─── Custom error class ───────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API — one function per business operation
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const AuthAPI = {
  login: (email, password) =>
    secureRequest("/auth/login", { email, password }),

  register: (data) =>
    secureRequest("/auth/register", data),

  verifyCode: (email, code) =>
    secureRequest("/auth/verify", { email, code }),

  logout: async () => {
    await secureRequest("/auth/logout", {});
    clearSession();
  },
};

// ─── Products ─────────────────────────────────────────────────────────────────

export const ProductsAPI = {
  list: () => secureGet("/products"),
  create: (product) => secureRequest("/products", product),
  update: (id, changes) => secureRequest(`/products/${id}`, changes, "PUT"),
  delete: (id) => secureRequest(`/products/${id}`, {}, "DELETE"),
  adjustStock: (id, delta) => secureRequest(`/products/${id}/stock`, { delta }),
};

// ─── Sales / POS ──────────────────────────────────────────────────────────────

export const SalesAPI = {
  create: (sale) => secureRequest("/sales", sale),
  list: (page = 1, limit = 50) => secureGet("/sales", { page, limit }),
};

// ─── Tickets ──────────────────────────────────────────────────────────────────

export const TicketsAPI = {
  list: () => secureGet("/tickets"),
  save: (ticket) => secureRequest("/tickets", ticket),
  charge: (id, payment) => secureRequest(`/tickets/${id}/charge`, payment),
  delete: (id) => secureRequest(`/tickets/${id}`, {}, "DELETE"),
};

// ─── Deudores ─────────────────────────────────────────────────────────────────

export const DeudoresAPI = {
  list: () => secureGet("/deudores"),
  create: (deudor) => secureRequest("/deudores", deudor),
  pay: (id, amount) => secureRequest(`/deudores/${id}/pay`, { amount }),
  delete: (id) => secureRequest(`/deudores/${id}`, {}, "DELETE"),
};

// ─── Gastos ───────────────────────────────────────────────────────────────────

export const GastosAPI = {
  list: () => secureGet("/gastos"),
  create: (gasto) => secureRequest("/gastos", gasto),
  delete: (id) => secureRequest(`/gastos/${id}`, {}, "DELETE"),
};

// ─── Reports ──────────────────────────────────────────────────────────────────

export const ReportsAPI = {
  summary: (period = "week") => secureGet("/reports/summary", { period }),
  deudores: () => secureGet("/reports/deudores"),
};