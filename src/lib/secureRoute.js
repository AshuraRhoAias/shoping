/**
 * lib/secureRoute.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps any Next.js API route handler with:
 *   1. Session validation
 *   2. Payload decryption (request)
 *   3. Payload encryption (response)
 *   4. Standard security headers
 *   5. Error sanitization (never leaks stack traces)
 *
 * Usage:
 *   export const POST = secureRoute(async (plainBody, session, request) => {
 *     // plainBody → already decrypted JS object
 *     // return any JS object → will be encrypted before sending
 *     return { ok: true, data: ... };
 *   });
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextResponse }                         from "next/server";
import { decryptClientPayload, encryptServerPayload } from "./crypto.server";

export function secureRoute(handler) {
  return async function (request) {
    const sessionId = request.headers.get("X-Session-Id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing session" },
        { status: 401, headers: secHeaders() }
      );
    }

    try {
      let plainBody = {};

      // Only decrypt if there is a body (POST/PUT/PATCH)
      const method = request.method.toUpperCase();
      if (["POST","PUT","PATCH"].includes(method)) {
        const envelope = await request.json();
        plainBody = decryptClientPayload(envelope, sessionId);
      }

      // Call business handler
      const result = await handler(plainBody, sessionId, request);

      // Encrypt response
      const responseEnvelope = encryptServerPayload(result, sessionId);

      return NextResponse.json(responseEnvelope, {
        status: 200,
        headers: secHeaders(),
      });

    } catch (err) {
      // Session expired or tampered payload
      if (err.message.includes("session") || err.message.includes("HMAC")) {
        return NextResponse.json(
          { error: "Session invalid" },
          { status: 401, headers: secHeaders() }
        );
      }

      console.error("[secureRoute]", err.message);
      return NextResponse.json(
        { error: "Internal error" },
        { status: 500, headers: secHeaders() }
      );
    }
  };
}

function secHeaders() {
  return {
    "Cache-Control":             "no-store, no-cache",
    "X-Content-Type-Options":    "nosniff",
    "X-Frame-Options":           "DENY",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "Referrer-Policy":           "no-referrer",
  };
}
