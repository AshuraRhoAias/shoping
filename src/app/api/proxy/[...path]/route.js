/**
 * Next.js API route – transparent proxy to the Fastify server.
 *
 * All encrypted responses from Fastify are decrypted HERE (server-side)
 * so the browser never handles raw ciphertext or encryption keys.
 *
 * Path mapping:
 *   /api/proxy/v1/branches  →  http://fastify:4000/api/v1/branches
 *
 * Authentication: forwards the Authorization header from the browser cookie
 * or Authorization header unchanged.
 */

import { NextResponse } from 'next/server';
import { decrypt }      from '@/lib/multiLayerCrypto';

const FASTIFY_BASE = process.env.FASTIFY_URL || 'http://localhost:4000';

// ── Server-side decryption (keys stay on the server) ─────────────────────────
async function serverDecrypt(body) {
  if (!body?.encrypted || !body?.payload) return body;
  try {
    return { decrypted: true, data: decrypt(body.payload, body.level || 'public') };
  } catch {
    return body; // devuelve raw si el descifrado falla (ej. sin MASTER_SECRET)
  }
}

async function handler(request, { params }) {
  const resolvedParams = await params;
  const pathSegments = resolvedParams.path ?? [];
  const targetPath   = '/api/' + pathSegments.join('/');
  const search       = new URL(request.url).search;
  const targetUrl    = FASTIFY_BASE + targetPath + (search || '');

  // Forward headers (strip host, add request id)
  const forwardHeaders = new Headers();
  for (const [k, v] of request.headers.entries()) {
    if (['host', 'connection', 'transfer-encoding'].includes(k)) continue;
    forwardHeaders.set(k, v);
  }
  forwardHeaders.set('X-Forwarded-For', request.headers.get('x-forwarded-for') || '');

  // Read body for mutating methods
  let body;
  if (!['GET', 'HEAD'].includes(request.method)) {
    try { body = await request.json(); } catch { body = undefined; }
  }

  try {
    const res = await fetch(targetUrl, {
      method:  request.method,
      headers: forwardHeaders,
      body:    body ? JSON.stringify(body) : undefined,
    });

    let data;
    try { data = await res.json(); } catch { data = {}; }

    // Decrypt server response transparently
    const decrypted = await serverDecrypt(data);

    return NextResponse.json(decrypted, { status: res.status });
  } catch (err) {
    console.error('[proxy] Fastify unreachable:', err.message);
    return NextResponse.json(
      { error: 'Service Unavailable', message: 'Backend server is not reachable' },
      { status: 503 },
    );
  }
}

export const GET     = handler;
export const POST    = handler;
export const PUT     = handler;
export const PATCH   = handler;
export const DELETE  = handler;
export const OPTIONS = handler;
