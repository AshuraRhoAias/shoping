import { NextResponse } from "next/server";
import { encryptServerPayload } from "@/lib/crypto.server";

// ─── Response helpers ─────────────────────────────────────────────────────────

export function err(status, message) {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(e) {
  if (e.status) return err(e.status, e.message);
  console.error(e);
  return err(500, "Internal error");
}

// ─── Auth utilities ───────────────────────────────────────────────────────────

export async function hashPassword(plain) {
  const { hash } = await import("bcryptjs");
  return hash(plain, 12);
}

export async function verifyPassword(plain, hashed) {
  const { compare } = await import("bcryptjs");
  return compare(plain, hashed);
}

// ─── Encrypted response ───────────────────────────────────────────────────────

/**
 * Encrypts `data` with the session key and returns a NextResponse JSON
 * containing the AES-256-GCM envelope. Never sends plaintext to the client.
 */
export function encryptedResponse(data, sessionId) {
  const envelope = encryptServerPayload(data, sessionId);
  return NextResponse.json(envelope, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
