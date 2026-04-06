-- ============================================================
--  Schema MySQL 8+ – Shop Platform
--  Ejecutado automáticamente en el primer arranque
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── Sucursales ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id          CHAR(36)      PRIMARY KEY DEFAULT (UUID()),
  name        VARCHAR(120)  NOT NULL,
  address     TEXT,
  phone       VARCHAR(30),
  timezone    VARCHAR(60)   NOT NULL DEFAULT 'UTC',
  active      TINYINT(1)    NOT NULL DEFAULT 1,
  metadata    JSON,
  created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Usuarios ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash TEXT         NOT NULL,
  role          ENUM('user','seller','admin','superadmin') NOT NULL DEFAULT 'user',
  branch_id     CHAR(36),
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_branch (branch_id),
  CONSTRAINT fk_users_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Productos ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          CHAR(36)      PRIMARY KEY DEFAULT (UUID()),
  name        VARCHAR(200)  NOT NULL,
  description TEXT,
  price       DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  cost_price  DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  sku         VARCHAR(100),
  barcode     VARCHAR(100),
  category    VARCHAR(80),
  tags        JSON,
  images      JSON,
  active      TINYINT(1)    NOT NULL DEFAULT 1,
  created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_products_sku      (sku),
  KEY idx_products_category (category),
  FULLTEXT KEY ft_products_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Inventario por sucursal ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branch_inventory (
  id          CHAR(36)    PRIMARY KEY DEFAULT (UUID()),
  branch_id   CHAR(36)    NOT NULL,
  product_id  CHAR(36)    NOT NULL,
  quantity    INT         NOT NULL DEFAULT 0,
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_inv (branch_id, product_id),
  CONSTRAINT fk_inv_branch  FOREIGN KEY (branch_id)  REFERENCES branches(id)  ON DELETE CASCADE,
  CONSTRAINT fk_inv_product FOREIGN KEY (product_id) REFERENCES products(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Pedidos ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               CHAR(36)      PRIMARY KEY DEFAULT (UUID()),
  user_id          CHAR(36)      NOT NULL,
  branch_id        CHAR(36)      NOT NULL,
  status           ENUM('pending','confirmed','processing','shipped','delivered','cancelled','refunded')
                                 NOT NULL DEFAULT 'pending',
  subtotal         DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  discount         DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  tax              DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  total            DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  payment_method   VARCHAR(40),
  shipping_address JSON,
  notes            TEXT,
  cancel_reason    TEXT,
  cancelled_at     DATETIME(3),
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_orders_user    (user_id),
  KEY idx_orders_branch  (branch_id),
  KEY idx_orders_status  (status),
  KEY idx_orders_created (created_at),
  CONSTRAINT fk_orders_user   FOREIGN KEY (user_id)   REFERENCES users(id)    ON DELETE RESTRICT,
  CONSTRAINT fk_orders_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Líneas de pedido ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id          CHAR(36)      PRIMARY KEY DEFAULT (UUID()),
  order_id    CHAR(36)      NOT NULL,
  product_id  CHAR(36)      NOT NULL,
  quantity    INT           NOT NULL DEFAULT 1,
  unit_price  DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  total       DECIMAL(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  KEY idx_oi_order   (order_id),
  KEY idx_oi_product (product_id),
  CONSTRAINT fk_oi_order   FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Log de auditoría ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGINT       AUTO_INCREMENT PRIMARY KEY,
  user_id     CHAR(36),
  action      VARCHAR(80)  NOT NULL,
  entity      VARCHAR(60),
  entity_id   CHAR(36),
  payload     JSON,
  ip          VARCHAR(45),
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_audit_user    (user_id),
  KEY idx_audit_action  (action),
  KEY idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ── POS: productos campos extra ───────────────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS emoji         VARCHAR(10);
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_base64  MEDIUMTEXT;

-- ── POS: ventas ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_sales (
  id              CHAR(36)      PRIMARY KEY DEFAULT (UUID()),
  total           DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  payment_method  VARCHAR(40),
  operator_id     CHAR(36),
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pos_sale_items (
  id           CHAR(36)      PRIMARY KEY DEFAULT (UUID()),
  pos_sale_id  CHAR(36)      NOT NULL,
  product_id   CHAR(36)      NOT NULL,
  qty          INT           NOT NULL DEFAULT 1,
  price        DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  KEY idx_psi_sale (pos_sale_id),
  CONSTRAINT fk_psi_sale    FOREIGN KEY (pos_sale_id) REFERENCES pos_sales(id)  ON DELETE CASCADE,
  CONSTRAINT fk_psi_product FOREIGN KEY (product_id)  REFERENCES products(id)   ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── POS: tickets (comandas) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_tickets (
  id              CHAR(36)      PRIMARY KEY DEFAULT (UUID()),
  total           DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  client          VARCHAR(120),
  location        VARCHAR(80),
  note            TEXT,
  saved_by        VARCHAR(80),
  paid            TINYINT(1)    NOT NULL DEFAULT 0,
  payment_method  VARCHAR(40),
  charged_by      VARCHAR(80),
  charged_at      DATETIME(3),
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pos_ticket_items (
  id             CHAR(36)      PRIMARY KEY DEFAULT (UUID()),
  pos_ticket_id  CHAR(36)      NOT NULL,
  product_id     CHAR(36)      NOT NULL,
  qty            INT           NOT NULL DEFAULT 1,
  price          DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  KEY idx_pti_ticket (pos_ticket_id),
  CONSTRAINT fk_pti_ticket  FOREIGN KEY (pos_ticket_id) REFERENCES pos_tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_pti_product FOREIGN KEY (product_id)    REFERENCES products(id)    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── POS: deudores ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_debtors (
  id           CHAR(36)      PRIMARY KEY DEFAULT (UUID()),
  name         VARCHAR(120)  NOT NULL,
  phone        VARCHAR(30),
  concept      TEXT,
  total_debt   DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  paid         DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  pending      DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  status       VARCHAR(30)   NOT NULL DEFAULT 'Al Día',
  days_overdue INT           NOT NULL DEFAULT 0,
  created_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── POS: gastos ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_expenses (
  id          CHAR(36)      PRIMARY KEY DEFAULT (UUID()),
  description TEXT          NOT NULL,
  amount      DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  category    VARCHAR(80),
  note        TEXT,
  operator_id CHAR(36),
  created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

