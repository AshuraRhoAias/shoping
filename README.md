# Fit & Ecoree House — Shop Admin

Sistema POS y panel de administración para múltiples sucursales.  
Stack: **Next.js 16** (frontend) + **Fastify 5** (API) + **MySQL 8 / PostgreSQL 16**.

---

## Estructura del proyecto

```
shoping/
├── src/                  # Next.js 16 App Router
│   ├── app/              # Páginas y rutas API
│   │   ├── api/pos/      # POS encriptado (ECDH + AES-256-GCM)
│   │   ├── api/proxy/    # Proxy transparente → Fastify
│   │   └── dashboard/    # Panel de admin (Server Components)
│   ├── lib/              # Utilidades servidor/cliente
│   └── middleware.js     # Seguridad: CSRF, HTTPS, headers
└── server/               # Fastify API
    ├── routes/           # auth, users, orders, products, branches, analytics
    ├── db/               # Pool MySQL/PostgreSQL + repos
    ├── plugins/          # JWT, CORS, cifrado multi-capa, rate-limit
    └── scripts/          # Wizard de setup con Docker
```

---

## Inicio rápido

### 1. Servidor Fastify

```bash
cd server
cp .env.example .env          # edita las claves secretas
npm install
npm start                     # wizard interactivo → crea DB Docker
```

### 2. Frontend Next.js

```bash
# en la raíz del proyecto
cp .env.local.example .env.local   # edita con los mismos valores del servidor
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

**Credenciales demo** (sin backend):
- `admin@fit.com` / `admin123`
- `cliente@fit.com` / `cliente123`

---

## Variables de entorno

| Archivo | Propósito |
|---------|-----------|
| `server/.env` | Configuración del servidor Fastify (generado por el wizard) |
| `.env.local` | Variables del frontend Next.js (copia de `.env.local.example`) |

> `MASTER_SECRET` y `MASTER_SALT` deben ser idénticos en ambos archivos.

---

## Seguridad

- **ECDH P-256** — intercambio de claves efímero por sesión POS
- **AES-256-GCM + HMAC-SHA-256** — cifrado autenticado de cada petición/respuesta
- **Cifrado multi-capa** — 5 capas para datos del backend (admin, user, public)
- **JWT HS512** — access token (15 min) + refresh token (7 días)
- **Rate limiting** — por IP, configurable por ruta
- **Middleware** — headers CSP, HSTS, X-Frame-Options, validación CSRF

---

## Requisitos

- Node.js ≥ 20
- Docker (para el wizard de base de datos)
- MySQL 8+ o PostgreSQL 16+
