/**
 * proxy.js  (Next.js 16 — reemplaza middleware.js)
 * ─────────────────────────────────────────────────────────────────────────────
 * Corre en el servidor antes de que cada request llegue a una ruta o página.
 *
 * Responsabilidades:
 *   1. Inyectar cabeceras de seguridad en cada respuesta.
 *   2. Redirigir HTTP → HTTPS en producción.
 *   3. Verificar origen CSRF para llamadas mutantes a /api/pos.
 *   4. Bloquear navegación directa del browser a rutas /api/.
 */

import { NextResponse } from "next/server";

const ALLOWED_ORIGIN = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const IS_PROD        = process.env.NODE_ENV === "production";

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const method       = request.method.toUpperCase();
  const reqOrigin    = request.headers.get("origin") ?? "";

  // ── 1. Redirect HTTP → HTTPS en producción ───────────────────────────────
  if (IS_PROD && request.nextUrl.protocol === "http:") {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 301);
  }

  // ── 2. CSRF origin check para rutas mutantes /api/pos ────────────────────
  if (pathname.startsWith("/api/pos") && ["POST","PUT","PATCH","DELETE"].includes(method)) {
    if (IS_PROD && reqOrigin && reqOrigin !== ALLOWED_ORIGIN) {
      return new NextResponse(JSON.stringify({ error: "Forbidden origin" }), {
        status:  403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ── 3. Bloquear navegación directa del browser a /api/ ───────────────────
  if (pathname.startsWith("/api/") && request.headers.get("sec-fetch-mode") === "navigate") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // ── 4. Cabeceras de seguridad en cada respuesta ───────────────────────────
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
