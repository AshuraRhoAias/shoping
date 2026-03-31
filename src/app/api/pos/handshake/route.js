/**
 * app/api/pos/handshake/route.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ECDH Handshake endpoint.
 *
 * POST /api/pos/handshake
 *   Body: { clientPublicKey: "<Base64 uncompressed P-256 point>" }
 *   Response: { serverPublicKey: "<Base64>", sessionId: "<hex>" }
 *
 * This file runs exclusively on the server (Next.js App Router).
 * It is never bundled into the client JavaScript.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextResponse } from "next/server";
import { processHandshake } from "@/lib/crypto.server";
import { rateLimit }        from "@/lib/rateLimit";       // see lib/rateLimit.js

export const runtime = "nodejs"; // force Node runtime (not Edge) for crypto

export async function POST(request) {
  // ── Rate limiting (5 handshakes / IP / minute) ──────────────────────────
  const limitResult = await rateLimit(request, { max: 5, windowMs: 60_000 });
  if (!limitResult.ok) {
    return NextResponse.json(
      { error: "Too many handshake requests" },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { clientPublicKey } = body;

    if (!clientPublicKey || typeof clientPublicKey !== "string") {
      return NextResponse.json(
        { error: "Missing clientPublicKey" },
        { status: 400 }
      );
    }

    const { serverPublicKeyB64, sessionId } = processHandshake(clientPublicKey);

    return NextResponse.json(
      { serverPublicKey: serverPublicKeyB64, sessionId },
      {
        status: 200,
        headers: securityHeaders(),
      }
    );
  } catch (err) {
    console.error("[handshake]", err.message);
    return NextResponse.json({ error: "Handshake failed" }, { status: 500 });
  }
}

function securityHeaders() {
  return {
    "Cache-Control":             "no-store",
    "X-Content-Type-Options":    "nosniff",
    "X-Frame-Options":           "DENY",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "Content-Security-Policy":   "default-src 'none'",
  };
}
