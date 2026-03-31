/**
 * middleware.js  (Next.js root middleware)
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs on the EDGE before every request reaches a route or page.
 * This file is SERVER-ONLY and never bundled into the browser.
 *
 * Responsibilities:
 *   1. Inject security headers on every response.
 *   2. Block non-HTTPS in production.
 *   3. CSRF origin check for all mutating API calls.
 *   4. Strip sensitive internal headers before forwarding to routes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextResponse } from "next/server";

const ALLOWED_ORIGIN = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const IS_PROD        = process.env.NODE_ENV === "production";

export function middleware(request) {
  const { pathname, origin } = request.nextUrl;
  const method  = request.method.toUpperCase();
  const reqOrigin = request.headers.get("origin") ?? "";

  // ── 1. Redirect HTTP → HTTPS in production ────────────────────────────────
  if (IS_PROD && request.nextUrl.protocol === "http:") {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 301);
  }

  // ── 2. CSRF origin check for mutating API routes ──────────────────────────
  //    The handshake and all POS endpoints only accept requests from our domain.
  if (pathname.startsWith("/api/pos") && ["POST","PUT","PATCH","DELETE"].includes(method)) {
    if (IS_PROD && reqOrigin && reqOrigin !== ALLOWED_ORIGIN) {
      return new NextResponse(JSON.stringify({ error: "Forbidden origin" }), {
        status:  403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ── 3. Block direct browser navigation to API routes ──────────────────────
  //    API routes should only be called by the JS fetch layer, not navigated to.
  if (pathname.startsWith("/api/") && request.headers.get("sec-fetch-mode") === "navigate") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // ── 4. Continue with security headers on every response ───────────────────
  const response = NextResponse.next();

  // Prevent browsers from inferring MIME types
  response.headers.set("X-Content-Type-Options",  "nosniff");
  // Prevent framing (clickjacking)
  response.headers.set("X-Frame-Options",         "DENY");
  // Enforce HTTPS for 2 years (only sent over HTTPS)
  if (IS_PROD) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  // No referrer on cross-origin requests
  response.headers.set("Referrer-Policy",         "strict-origin-when-cross-origin");
  // Limit browser feature access
  response.headers.set("Permissions-Policy",      "camera=(), microphone=(), geolocation=()");
  // Content Security Policy — tighten as needed
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src  'self' 'unsafe-inline' 'unsafe-eval'", // remove unsafe-inline once you have nonces
      "style-src   'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src    'self' https://fonts.gstatic.com",
      "img-src     'self' data: blob:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; ")
  );

  // Strip any accidentally forwarded internal headers
  response.headers.delete("X-Powered-By");

  return response;
}

export const config = {
  // Apply middleware to every route EXCEPT Next.js static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
