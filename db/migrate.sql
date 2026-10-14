-- =============================================================================
-- Polar Fiber – forward migration (MySQL 8 compatible, safe to re-run)
-- Run: node db/migrate.mjs
--
-- MySQL has no ADD COLUMN IF NOT EXISTS / ADD INDEX IF NOT EXISTS, so every
-- change is its own statement and the runner skips statements that were
-- already applied (duplicate column / duplicate key / etc.).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. users  – add updated_at, deleted_at (soft delete)
-- -----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;
ALTER TABLE users ADD COLUMN deleted_at DATETIME NULL AFTER updated_at;

-- -----------------------------------------------------------------------------
-- 2. categories  – add slug, description, created_at
-- -----------------------------------------------------------------------------
ALTER TABLE categories ADD COLUMN slug VARCHAR(100) NULL AFTER name;
ALTER TABLE categories ADD COLUMN description TEXT NULL AFTER slug;
ALTER TABLE categories ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER description;

-- Back-fill slug from name (lowercase, spaces → hyphens)
UPDATE categories SET slug = REPLACE(LOWER(name), ' ', '-') WHERE slug IS NULL OR slug = '';

ALTER TABLE categories MODIFY COLUMN slug VARCHAR(100) NOT NULL;
ALTER TABLE categories ADD UNIQUE KEY uq_categories_slug (slug);

-- -----------------------------------------------------------------------------
-- 3. products  – add sku, slug, status, updated_at, deleted_at
--    (existing image column is kept; product_images is a new additive table)
-- -----------------------------------------------------------------------------
ALTER TABLE products ADD COLUMN sku VARCHAR(80) NULL AFTER product_id;
ALTER TABLE products ADD COLUMN slug VARCHAR(200) NULL AFTER name;
ALTER TABLE products ADD COLUMN status ENUM('active','draft','archived') NOT NULL DEFAULT 'active' AFTER description;
ALTER TABLE products ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;
ALTER TABLE products ADD COLUMN deleted_at DATETIME NULL AFTER updated_at;

-- Back-fill slug from name
UPDATE products SET slug = REPLACE(LOWER(name), ' ', '-') WHERE slug IS NULL OR slug = '';

-- Back-fill sku: 'PF-' + zero-padded product_id
UPDATE products SET sku = CONCAT('PF-', LPAD(product_id, 5, '0')) WHERE sku IS NULL OR sku = '';

ALTER TABLE products MODIFY COLUMN slug VARCHAR(200) NOT NULL;
ALTER TABLE products MODIFY COLUMN sku VARCHAR(80) NOT NULL;
ALTER TABLE products ADD UNIQUE KEY uq_products_slug (slug);
ALTER TABLE products ADD UNIQUE KEY uq_products_sku (sku);

ALTER TABLE products ADD INDEX idx_products_category_status (category_id, status);

-- -----------------------------------------------------------------------------
-- 4. product_images  – new table (additive, does not touch products.image)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_images (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  product_id  INT          NOT NULL,
  url         VARCHAR(500) NOT NULL,
  alt_text    VARCHAR(200) NULL,
  sort_order  SMALLINT     NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

ALTER TABLE product_images ADD INDEX idx_product_images_product (product_id);

-- -----------------------------------------------------------------------------
-- 5. orders  – add order_number, payment_status, updated_at
--    Status ENUM casing kept as-is (mixed-case) per approval.
-- -----------------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN order_number VARCHAR(30) NULL AFTER order_id;
ALTER TABLE orders ADD COLUMN payment_status ENUM('unpaid','pending_verification','paid','refunded') NOT NULL DEFAULT 'unpaid' AFTER is_paid;
ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- Back-fill order_number from order_id (format: PF-ORD-1001)
UPDATE orders SET order_number = CONCAT('PF-ORD-', order_id) WHERE order_number IS NULL OR order_number = '';

-- order_number must stay NULL-able: MySQL cannot derive it from the AUTO_INCREMENT
-- id at INSERT time, so every code path inserts first and backfills the value
-- afterwards (see placeOrder / convertQuoteToOrder in backend/api.functions.ts).
ALTER TABLE orders MODIFY COLUMN order_number VARCHAR(30) NULL;
ALTER TABLE orders ADD UNIQUE KEY uq_orders_order_number (order_number);

-- Sync payment_status from legacy is_paid flag for existing rows
UPDATE orders SET payment_status = 'paid' WHERE is_paid = 1 AND payment_status = 'unpaid';

ALTER TABLE orders ADD INDEX idx_orders_user_status_created (user_id, status, created_at);

-- -----------------------------------------------------------------------------
-- 6. quote_requests  – add quote_number, phone, updated_at
-- -----------------------------------------------------------------------------
ALTER TABLE quote_requests ADD COLUMN quote_number VARCHAR(30) NULL AFTER quote_id;
ALTER TABLE quote_requests ADD COLUMN phone VARCHAR(30) NULL AFTER email;
ALTER TABLE quote_requests ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- Back-fill quote_number
UPDATE quote_requests SET quote_number = CONCAT('PF-QT-', quote_id) WHERE quote_number IS NULL OR quote_number = '';

ALTER TABLE quote_requests MODIFY COLUMN quote_number VARCHAR(30) NOT NULL;
ALTER TABLE quote_requests ADD UNIQUE KEY uq_quote_requests_quote_number (quote_number);

-- -----------------------------------------------------------------------------
-- 7. support_tickets  – add 'Closed' to status ENUM
-- -----------------------------------------------------------------------------
ALTER TABLE support_tickets MODIFY COLUMN status ENUM('Open','In Progress','Resolved','Closed') NOT NULL DEFAULT 'Open';

-- -----------------------------------------------------------------------------
-- 8. addresses  – new table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS addresses (
  address_id  INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  label       VARCHAR(80)  NOT NULL DEFAULT 'Home',   -- e.g. Home, Office
  recipient   VARCHAR(100) NOT NULL,
  phone       VARCHAR(30)  NOT NULL DEFAULT '',
  line1       VARCHAR(200) NOT NULL,
  line2       VARCHAR(200) NULL,
  city        VARCHAR(100) NOT NULL DEFAULT 'Addis Ababa',
  region      VARCHAR(100) NULL,
  country     VARCHAR(80)  NOT NULL DEFAULT 'Ethiopia',
  is_default  TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

ALTER TABLE addresses ADD INDEX idx_addresses_user (user_id);

-- -----------------------------------------------------------------------------
-- 9. favorites  – new table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS favorites (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  product_id  INT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY  uq_favorites_user_product (user_id, product_id),
  FOREIGN KEY (user_id)    REFERENCES users(user_id)       ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 10. stock_movements  – add note, add explicit index
-- -----------------------------------------------------------------------------
ALTER TABLE stock_movements ADD COLUMN note VARCHAR(255) NULL AFTER reference_id;

ALTER TABLE stock_movements ADD INDEX idx_stock_movements_product (product_id);

-- -----------------------------------------------------------------------------
-- 11. notifications  – add composite index (user_id, is_read)
-- -----------------------------------------------------------------------------
ALTER TABLE notifications ADD INDEX idx_notifications_user_read (user_id, is_read);

-- -----------------------------------------------------------------------------
-- 12. message_replies  – add explicit index on message_id
-- -----------------------------------------------------------------------------
ALTER TABLE message_replies ADD INDEX idx_message_replies_message (message_id);

-- -----------------------------------------------------------------------------
-- 13. audit_logs  – add composite indexes
-- -----------------------------------------------------------------------------
ALTER TABLE audit_logs ADD INDEX idx_audit_logs_created_at (created_at);
ALTER TABLE audit_logs ADD INDEX idx_audit_logs_entity (entity_type, entity_id);

-- -----------------------------------------------------------------------------
-- 14. categories  – parent_id, sort_order  (admin spec)
-- -----------------------------------------------------------------------------
ALTER TABLE categories ADD COLUMN parent_id INT NULL AFTER category_id;
ALTER TABLE categories ADD COLUMN sort_order SMALLINT NOT NULL DEFAULT 0 AFTER description;

ALTER TABLE categories ADD CONSTRAINT fk_cat_parent FOREIGN KEY (parent_id) REFERENCES categories(category_id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 15. quote_requests  – delivery_location
-- -----------------------------------------------------------------------------
ALTER TABLE quote_requests ADD COLUMN delivery_location VARCHAR(255) NULL AFTER message;

-- -----------------------------------------------------------------------------
-- 16. app_settings  – SMTP + business settings seed rows
-- -----------------------------------------------------------------------------
INSERT IGNORE INTO app_settings (setting_key, setting_value, description) VALUES
  ('vat_rate',           '0',   'VAT percentage applied to orders (e.g. 15 for 15%)'),
  ('delivery_fee',       '0',   'Flat delivery fee in ETB'),
  ('low_stock_threshold','5',   'Products at or below this stock level are flagged as low stock'),
  ('smtp_host',          '',    'SMTP server hostname'),
  ('smtp_port',          '587', 'SMTP authentication port'),
  ('smtp_user',          '',    'SMTP authentication username'),
  ('smtp_password_enc',  '',    'AES-256-GCM encrypted SMTP password (base64)'),
  ('smtp_from',          '',    'Sender address for outgoing email');

-- -----------------------------------------------------------------------------
-- 17. Guest checkout: make orders.user_id nullable + order_access table
--     Customer registration is removed; orders can now be placed by guests
--     without a user account. Order access is secured via a password stored
--     in the order_access table.
--     THIS is the change that fixes "Column 'user_id' cannot be null".
-- -----------------------------------------------------------------------------
ALTER TABLE orders MODIFY COLUMN user_id INT NULL;

CREATE TABLE IF NOT EXISTS order_access (
  order_id       INT PRIMARY KEY,
  access_pass    CHAR(96)    NOT NULL,   -- bcrypt hash
  email          VARCHAR(255) NOT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

ALTER TABLE order_access ADD INDEX idx_order_access_email (email);

-- -----------------------------------------------------------------------------
-- 18. Order communication, delivery management & guest contact details
--     Foundation for customer/staff messaging, delivery tracking and guest
--     customer contact persistence. All additive — nothing here drops data.
--     - orders.customer_name / customer_phone: guest checkout contact details
--       were previously validated and then discarded (email lives in
--       order_access and stays the single source of truth for it).
--     - order_messages: the customer-visible conversation + update feed. Also
--       the in-app channel for GUESTS, because notifications.user_id is a
--       NOT NULL foreign key and therefore cannot address a guest.
--     - order_internal_notes: staff-only notes, kept strictly separate from
--       customer-visible messages and never returned by any public endpoint.
--     - order_deliveries: dispatch/delivery completion records.
--     - notifications.dedupe_key: makes notification inserts idempotent so a
--       retried request cannot produce duplicate notifications (INSERT IGNORE
--       against a UNIQUE column; multiple NULLs are allowed by MySQL).
-- -----------------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN customer_name VARCHAR(100) NULL AFTER user_id;
ALTER TABLE orders ADD COLUMN customer_phone VARCHAR(30) NULL AFTER customer_name;

CREATE TABLE IF NOT EXISTS order_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  sender_type ENUM('customer','staff','admin','system') NOT NULL,
  sender_user_id INT NULL,
  sender_name VARCHAR(100) NOT NULL,
  kind ENUM('message','status','delivery','system') NOT NULL DEFAULT 'message',
  body VARCHAR(2000) NULL,
  status_from VARCHAR(50) NULL,
  status_to VARCHAR(50) NULL,
  client_message_id VARCHAR(64) NULL,
  is_read_by_customer TINYINT(1) NOT NULL DEFAULT 0,
  is_read_by_staff TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (sender_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  UNIQUE KEY uq_order_messages_client (client_message_id),
  INDEX idx_order_messages_order (order_id, id),
  INDEX idx_order_messages_unread_staff (order_id, is_read_by_staff)
);

CREATE TABLE IF NOT EXISTS order_internal_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  staff_id INT NULL,
  staff_name VARCHAR(100) NOT NULL,
  note VARCHAR(2000) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_order_internal_notes_order (order_id, id)
);

CREATE TABLE IF NOT EXISTS order_deliveries (
  order_id INT PRIMARY KEY,
  assigned_to INT NULL,
  delivery_notes TEXT NULL,
  expected_delivery_date DATE NULL,
  dispatched_at DATETIME NULL,
  dispatched_by INT NULL,
  dispatched_note VARCHAR(255) NULL,
  delivered_at DATETIME NULL,
  delivered_by INT NULL,
  delivered_by_name VARCHAR(100) NULL,
  completion_notes TEXT NULL,
  confirmation_name VARCHAR(100) NULL,
  confirmation_details VARCHAR(255) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (dispatched_by) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (delivered_by) REFERENCES users(user_id) ON DELETE SET NULL
);

ALTER TABLE notifications ADD COLUMN dedupe_key VARCHAR(100) NULL;
ALTER TABLE notifications ADD UNIQUE KEY uq_notifications_dedupe (dedupe_key);

