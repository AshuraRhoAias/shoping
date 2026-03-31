/**
 * Typed API client for communicating with the Fastify backend.
 *
 * All responses are wrapped in { encrypted, level, payload }.
 * This client decrypts them transparently.
 *
 * The decryption must happen server-side (via Next.js API routes)
 * because the master keys must NOT be shipped to the browser.
 * Browser components call /api/proxy/* which decrypts + re-serialises.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';

class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.name    = 'ApiError';
    this.status  = status;
    this.body    = body;
  }
}

async function apiFetch(path, options = {}, token = null) {
  const url     = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, json.message || res.statusText, json);
  }

  return json;
}

export const apiClient = {
  // ── Auth ──────────────────────────────────────────────────────────────────────
  auth: {
    login:    (email, password)   => apiFetch('/api/v1/auth/login',    { method: 'POST', body: { email, password } }),
    register: (data)              => apiFetch('/api/v1/auth/register', { method: 'POST', body: data }),
    refresh:  (refreshToken)      => apiFetch('/api/v1/auth/refresh',  { method: 'POST', body: { refreshToken } }),
    me:       (token)             => apiFetch('/api/v1/auth/me',       {}, token),
    logout:   (token)             => apiFetch('/api/v1/auth/logout',   { method: 'POST' }, token),
  },

  // ── Branches ──────────────────────────────────────────────────────────────────
  branches: {
    list:    (token, params = {}) => apiFetch('/api/v1/branches?' + new URLSearchParams(params), {}, token),
    summary: (token)              => apiFetch('/api/v1/branches/all/summary', {}, token),
    get:     (token, id)          => apiFetch(`/api/v1/branches/${id}`, {}, token),
    create:  (token, data)        => apiFetch('/api/v1/branches', { method: 'POST', body: data }, token),
    update:  (token, id, data)    => apiFetch(`/api/v1/branches/${id}`, { method: 'PATCH', body: data }, token),
    stats:   (token, id, params)  => apiFetch(`/api/v1/branches/${id}/stats?` + new URLSearchParams(params), {}, token),
    inventory:(token, id, params) => apiFetch(`/api/v1/branches/${id}/inventory?` + new URLSearchParams(params), {}, token),
    sync:    (token, id)          => apiFetch(`/api/v1/branches/${id}/sync`, { method: 'POST' }, token),
  },

  // ── Products ──────────────────────────────────────────────────────────────────
  products: {
    list:   (params = {}, token)  => apiFetch('/api/v1/products?' + new URLSearchParams(params), {}, token),
    get:    (id, token)           => apiFetch(`/api/v1/products/${id}`, {}, token),
    create: (token, data)         => apiFetch('/api/v1/products', { method: 'POST', body: data }, token),
    update: (token, id, data)     => apiFetch(`/api/v1/products/${id}`, { method: 'PATCH', body: data }, token),
    delete: (token, id)           => apiFetch(`/api/v1/products/${id}`, { method: 'DELETE' }, token),
    bulk:   (token, products)     => apiFetch('/api/v1/products/bulk', { method: 'POST', body: { products } }, token),
  },

  // ── Orders ────────────────────────────────────────────────────────────────────
  orders: {
    list:        (token, params = {})        => apiFetch('/api/v1/orders?' + new URLSearchParams(params), {}, token),
    get:         (token, id)                 => apiFetch(`/api/v1/orders/${id}`, {}, token),
    create:      (token, data)               => apiFetch('/api/v1/orders', { method: 'POST', body: data }, token),
    updateStatus:(token, id, status, comment)=> apiFetch(`/api/v1/orders/${id}/status`, { method: 'PATCH', body: { status, comment } }, token),
    cancel:      (token, id, reason)         => apiFetch(`/api/v1/orders/${id}/cancel`, { method: 'POST', body: { reason } }, token),
    byBranch:    (token, branchId, params)   => apiFetch(`/api/v1/orders/branch/${branchId}?` + new URLSearchParams(params), {}, token),
  },

  // ── Analytics ─────────────────────────────────────────────────────────────────
  analytics: {
    overview:   (token)               => apiFetch('/api/v1/analytics/overview', {}, token),
    revenue:    (token, params = {})  => apiFetch('/api/v1/analytics/revenue?' + new URLSearchParams(params), {}, token),
    products:   (token, params = {})  => apiFetch('/api/v1/analytics/products?' + new URLSearchParams(params), {}, token),
    users:      (token, params = {})  => apiFetch('/api/v1/analytics/users?' + new URLSearchParams(params), {}, token),
    branches:   (token, params = {})  => apiFetch('/api/v1/analytics/branches?' + new URLSearchParams(params), {}, token),
    branch:     (token, id, params)   => apiFetch(`/api/v1/analytics/branches/${id}?` + new URLSearchParams(params), {}, token),
  },

  // ── Admin ─────────────────────────────────────────────────────────────────────
  admin: {
    dashboard:    (token)         => apiFetch('/api/v1/admin/dashboard', {}, token),
    users:        (token, params) => apiFetch('/api/v1/admin/users?' + new URLSearchParams(params), {}, token),
    changeRole:   (token, id, role, branchId) => apiFetch(`/api/v1/admin/users/${id}/role`, { method: 'POST', body: { role, branchId } }, token),
    branchToken:  (token, branchId) => apiFetch('/api/v1/admin/branch-token', { method: 'POST', body: { branchId } }, token),
    audit:        (token, params) => apiFetch('/api/v1/admin/audit?' + new URLSearchParams(params), {}, token),
    getConfig:    (token)         => apiFetch('/api/v1/admin/config', {}, token),
    updateConfig: (token, data)   => apiFetch('/api/v1/admin/config', { method: 'PUT', body: data }, token),
  },
};

export { ApiError };
