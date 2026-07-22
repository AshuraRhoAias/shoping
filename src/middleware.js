/**
 * middleware.js  (Next.js — runs before every request reaches a route/page)
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibilities:
 *   1. Redirect HTTP → HTTPS in production.
 *   2. Inject security headers in every response.
 */

import { NextResponse } from "next/server";

const IS_PROD      = process.env.NODE_ENV === "production";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export function middleware(request) {
  if (IS_PROD && request.nextUrl.protocol === "http:") {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 301);
  }

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
      "script-src  'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
      "style-src   'self' 'unsafe-inline' https://fonts.googleapis.com https://vercel.live",
      "font-src    'self' https://fonts.gstatic.com",
      "img-src     'self' data: blob: https://vercel.live https://vercel.com",
      `connect-src 'self' https://vercel.live wss://ws-us3.pusher.com${SUPABASE_URL ? ` ${SUPABASE_URL}` : ""}`,
      "frame-src   https://vercel.live",
      "frame-ancestors 'none'",
    ].join("; ")
  );

  response.headers.delete("X-Powered-By");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
