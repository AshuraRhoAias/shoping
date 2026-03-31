/**
 * middleware.js  (Next.js — runs before every request reaches a route/page)
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibilities:
 *   1. Inject security headers in every response.
 *   2. Redirect HTTP → HTTPS in production.
 *   3. CSRF origin check for mutating /api/pos calls.
 *   4. Block direct browser navigation to /api/ routes.
 */

import { NextResponse } from "next/server";

const ALLOWED_ORIGIN = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const IS_PROD        = process.env.NODE_ENV === "production";

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const method       = request.method.toUpperCase();
  const reqOrigin    = request.headers.get("origin") ?? "";

  // ── 1. Redirect HTTP → HTTPS in production ───────────────────────────────
  if (IS_PROD && request.nextUrl.protocol === "http:") {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 301);
  }

  // ── 2. CSRF origin check for mutating /api/pos requests ──────────────────
  if (pathname.startsWith("/api/pos") && ["POST","PUT","PATCH","DELETE"].includes(method)) {
    if (IS_PROD && reqOrigin && reqOrigin !== ALLOWED_ORIGIN) {
      return new NextResponse(JSON.stringify({ error: "Forbidden origin" }), {
        status:  403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ── 3. Block direct browser navigation to /api/ ──────────────────────────
  if (pathname.startsWith("/api/") && request.headers.get("sec-fetch-mode") === "navigate") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // ── 4. Security headers on every response ────────────────────────────────
  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options",  "nosniff");
  response.headers.set("X-Frame-Options",         "DENY");
  response.headers.set("Referrer-Policy",         "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy",      "camera=(), microphone=(), geolocation=()");

  if (IS_PROD) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src  'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src   'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src    'self' https://fonts.gstatic.com",
      "img-src     'self' data: blob:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; ")
  );

  response.headers.delete("X-Powered-By");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
