# Fastify API Server

High-performance Node.js API server for the shop platform.

## Architecture

```
server/
├── index.js              # Cluster entry-point (1 worker per CPU core)
├── app.js                # Fastify application builder
├── config/
│   └── encryption.js     # HKDF-derived keys (never touches disk)
├── plugins/
│   ├── cors.js           # @fastify/cors – configurable allowed origins
│   ├── jwt.js            # @fastify/jwt  – access / refresh / branch tokens
│   ├── encryption.js     # reply.sendEncrypted / request.decryptBody decorators
│   └── rateLimit.js      # @fastify/rate-limit – 2 000 req/min per IP
├── routes/
│   ├── auth.js           # POST /api/v1/auth/{register,login,refresh,logout,me}
│   ├── users.js          # CRUD /api/v1/users            (4-layer enc)
│   ├── admin.js          # CRUD /api/v1/admin            (5-layer enc)
│   ├── branches.js       # CRUD /api/v1/branches         (5-layer enc)
│   ├── products.js       # CRUD /api/v1/products + bulk  (3/4-layer enc)
│   ├── orders.js         # CRUD /api/v1/orders           (4-layer enc)
│   └── analytics.js      # GET  /api/v1/analytics        (5-layer enc)
└── utils/
    └── crypto.js         # Multi-layer encrypt / decrypt
```

## Encryption levels

| Level    | Layers | Algorithms (applied in order)                                          | Used for            |
|----------|--------|------------------------------------------------------------------------|---------------------|
| `public` | 3      | AES-256-GCM → ChaCha20-Poly1305 → AES-256-CBC + HMAC-SHA512           | All traffic         |
| `user`   | 4      | …public… → Camellia-256-CBC + HMAC-SHA512                              | User / client data  |
| `admin`  | 5      | …user… → AES-192-GCM                                                   | Admin / staff data  |

All keys are derived at startup from `MASTER_SECRET` + `MASTER_SALT` via **HKDF-SHA512**.  
Rotating the master secret instantly rotates every derived key.

## JWT tokens

| Token   | TTL    | Namespace | Signing alg |
|---------|--------|-----------|-------------|
| access  | 15 min | `access`  | HS512       |
| refresh | 7 days | `refresh` | HS512       |
| branch  | 24 h   | `branch`  | HS512       |

### Roles

`public` → `user` → `seller` → `admin` → `superadmin`

## Quick start

```bash
# 1. Install dependencies
cd server && npm install

# 2. Configure environment
cp .env.example .env
# Edit .env – generate keys with:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 3. Run
npm run dev           # single process, watch mode
npm start             # cluster mode (all CPU cores)
CLUSTER_WORKERS=1 npm start  # force single worker
```

## Performance (100k+ req/h)

- **Cluster mode**: N workers = N CPU cores. Zero-downtime worker restart on crash.
- **Rate limiter**: 2 000 req/min per IP (configurable). LRU cache for 10 000 IPs.
- **Compression**: gzip/deflate for responses > 1 KB.
- **Keep-alive**: Fastify default (HTTP/1.1 persistent connections).
- **Bulk endpoints**: `POST /api/v1/products/bulk` handles up to 1 000 items per call.
- **Body limit**: 5 MB default (configurable via `BODY_LIMIT`).

## API endpoints

### Auth
| Method | Path                        | Auth      | Enc level |
|--------|-----------------------------|-----------|-----------|
| POST   | /api/v1/auth/register       | –         | user      |
| POST   | /api/v1/auth/login          | –         | user      |
| POST   | /api/v1/auth/refresh        | –         | user      |
| POST   | /api/v1/auth/logout         | Bearer    | –         |
| GET    | /api/v1/auth/me             | Bearer    | user      |

### Branches
| Method | Path                              | Role           | Enc level |
|--------|-----------------------------------|----------------|-----------|
| GET    | /api/v1/branches                  | authenticated  | admin     |
| GET    | /api/v1/branches/all/summary      | admin+         | admin     |
| POST   | /api/v1/branches                  | admin+         | admin     |
| GET    | /api/v1/branches/:id              | authenticated  | admin     |
| PATCH  | /api/v1/branches/:id              | seller+        | admin     |
| DELETE | /api/v1/branches/:id              | superadmin     | –         |
| GET    | /api/v1/branches/:id/stats        | authenticated  | admin     |
| GET    | /api/v1/branches/:id/inventory    | authenticated  | admin     |
| POST   | /api/v1/branches/:id/sync         | admin+         | –         |

### Products
| Method | Path                          | Auth          | Enc level |
|--------|-------------------------------|---------------|-----------|
| GET    | /api/v1/products              | –             | public    |
| GET    | /api/v1/products/:id          | –             | public    |
| POST   | /api/v1/products              | seller+       | user      |
| PATCH  | /api/v1/products/:id          | seller+       | user      |
| DELETE | /api/v1/products/:id          | admin+        | –         |
| POST   | /api/v1/products/bulk         | seller+       | user      |

### Orders, Users, Admin, Analytics – see routes/ source files.

## Next.js integration

The Next.js app (port 3000) communicates with this server through:

1. **`/api/proxy/[...path]`** – server-side proxy that transparently decrypts Fastify responses before sending JSON to the browser.
2. **`src/lib/apiClient.js`** – typed fetch wrapper used in Server Components.
3. **`/dashboard`** – branch management UI (overview, per-branch KPIs, analytics).
