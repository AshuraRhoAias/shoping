-- ============================================================
--  Schema PostgreSQL – Shop Platform
--  Ejecutado automáticamente en el primer arranque
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- búsqueda full-text con LIKE rápido

-- ── Sucursales ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(120) NOT NULL,
  address     TEXT,
  phone       VARCHAR(30),
  timezone    VARCHAR(60)  NOT NULL DEFAULT 'UTC',
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  metadata    JSONB,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Usuarios ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'user'
                             CHECK (role IN ('user','seller','admin','superadmin')),
  branch_id     UUID         REFERENCES branches(id) ON DELETE SET NULL,
  active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role      ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);

-- ── Productos ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(200)   NOT NULL,
  description TEXT,
  price       NUMERIC(14,2)  NOT NULL DEFAULT 0 CHECK (price >= 0),
  cost_price  NUMERIC(14,2)  DEFAULT 0          CHECK (cost_price >= 0),
  sku         VARCHAR(100),
  barcode     VARCHAR(100),
  category    VARCHAR(80),
  tags        TEXT[]         DEFAULT '{}',
  images      TEXT[]         DEFAULT '{}',
  active      BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_sku      ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);

-- ── Inventario por sucursal ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branch_inventory (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   UUID          NOT NULL REFERENCES branches(id)  ON DELETE CASCADE,
  product_id  UUID          NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  quantity    INTEGER       NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_branch  ON branch_inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON branch_inventory(product_id);

-- ── Pedidos ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID           NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
  branch_id        UUID           NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  status           VARCHAR(20)    NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled','refunded')),
  subtotal         NUMERIC(14,2)  NOT NULL DEFAULT 0,
  discount         NUMERIC(14,2)  NOT NULL DEFAULT 0,
  tax              NUMERIC(14,2)  NOT NULL DEFAULT 0,
  total            NUMERIC(14,2)  NOT NULL DEFAULT 0,
  payment_method   VARCHAR(40),
  shipping_address JSONB,
  notes            TEXT,
  cancel_reason    TEXT,
  cancelled_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id   ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_status    ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created   ON orders(created_at DESC);

-- ── Líneas de pedido ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID           NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
  product_id  UUID           NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity    INTEGER        NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  NUMERIC(14,2)  NOT NULL DEFAULT 0,
  total       NUMERIC(14,2)  GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- ── Log de auditoría ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     UUID         REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(80)  NOT NULL,
  entity      VARCHAR(60),
  entity_id   UUID,
  payload     JSONB,
  ip          VARCHAR(45),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user      ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action    ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created   ON audit_log(created_at DESC);

-- ── POS: productos con campos extra (emoji, imagen base64) ──────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS emoji         VARCHAR(10);
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_base64  TEXT;

-- ── POS: ventas ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_sales (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  total           NUMERIC(14,2)  NOT NULL DEFAULT 0,
  payment_method  VARCHAR(40),
  operator_id     UUID,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS pos_sale_items (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_sale_id UUID           NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
  product_id  UUID           NOT NULL REFERENCES products(id)  ON DELETE RESTRICT,
  qty         INTEGER        NOT NULL DEFAULT 1,
  price       NUMERIC(14,2)  NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_pos_sale_items_sale ON pos_sale_items(pos_sale_id);

-- ── POS: tickets (comandas guardadas) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_tickets (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  total           NUMERIC(14,2)  NOT NULL DEFAULT 0,
  client          VARCHAR(120),
  location        VARCHAR(80),
  note            TEXT,
  saved_by        VARCHAR(80),
  paid            BOOLEAN        NOT NULL DEFAULT FALSE,
  payment_method  VARCHAR(40),
  charged_by      VARCHAR(80),
  charged_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS pos_ticket_items (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_ticket_id  UUID           NOT NULL REFERENCES pos_tickets(id) ON DELETE CASCADE,
  product_id     UUID           NOT NULL REFERENCES products(id)    ON DELETE RESTRICT,
  qty            INTEGER        NOT NULL DEFAULT 1,
  price          NUMERIC(14,2)  NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_pos_ticket_items_ticket ON pos_ticket_items(pos_ticket_id);

-- ── POS: deudores ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_debtors (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(120)   NOT NULL,
  phone        VARCHAR(30),
  concept      TEXT,
  total_debt   NUMERIC(14,2)  NOT NULL DEFAULT 0,
  paid         NUMERIC(14,2)  NOT NULL DEFAULT 0,
  pending      NUMERIC(14,2)  NOT NULL DEFAULT 0,
  status       VARCHAR(30)    NOT NULL DEFAULT 'Al Día',
  days_overdue INTEGER        NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── POS: gastos ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_expenses (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT           NOT NULL,
  amount      NUMERIC(14,2)  NOT NULL DEFAULT 0,
  category    VARCHAR(80),
  note        TEXT,
  operator_id UUID,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── Trigger: updated_at automático ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['branches','users','products','branch_inventory','orders'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated ON %1$s;
       CREATE TRIGGER trg_%1$s_updated
       BEFORE UPDATE ON %1$s
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;
