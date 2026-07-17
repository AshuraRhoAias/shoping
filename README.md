# Fit & Ecoree House — Shop Admin

Sistema POS y tienda en línea.
Stack: **Next.js 16** + **Supabase** (Auth + Postgres con Row Level Security).

---

## Estructura del proyecto

```
shoping/
└── src/
    ├── app/
    │   ├── page.js               # Entrada: sesión Supabase → Login o Dashboard
    │   ├── Page/Login/           # Login/registro con Supabase Auth
    │   └── Page/Dashboard/       # POS (admin/vendedor) y tienda (cliente)
    ├── lib/
    │   ├── supabaseClient.js     # Cliente Supabase + fetchAppUser
    │   └── api.service.js        # Acceso a datos (products, sales, tickets, …)
    └── middleware.js             # Headers de seguridad + HTTPS
```

---

## Inicio rápido

```bash
cp .env.local.example .env.local   # rellena URL y anon key de Supabase
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## Base de datos (Supabase)

Tablas usadas por la app (todas con RLS, acceso solo para usuarios autenticados):

| Tabla       | Propósito                                    |
|-------------|----------------------------------------------|
| `profiles`  | Perfil por usuario (username, rol, teléfono) — se crea solo al registrarse |
| `products`  | Catálogo (precio venta/compra, stock, imagen, categoría) |
| `sales`     | Ventas del POS (items jsonb, método de pago, total) |
| `tickets`   | Tickets guardados/pendientes de cobro         |
| `deudores`  | Créditos de clientes                          |
| `gastos`    | Gastos del negocio                            |

Roles (`profiles.role`): `admin` y `vendedor` ven el POS; `cliente` ve la tienda.

---

## Autenticación

- Registro con verificación por código OTP al correo (Supabase Auth).
- La sesión persiste entre recargas y se refresca sola.
- Las claves `NEXT_PUBLIC_SUPABASE_*` son públicas por diseño; la seguridad
  de los datos la aplican las políticas RLS en Postgres.

---

## Requisitos

- Node.js ≥ 20
- Un proyecto de Supabase con las tablas anteriores
