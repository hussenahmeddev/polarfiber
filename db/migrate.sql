-- =============================================================================
-- Polar Fiber – forward migration
-- Safe to run on a live database. All changes are additive.
-- Run: node db/migrate.mjs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. users  – add updated_at, deleted_at (soft delete)
-- -----------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER updated_at;

-- -----------------------------------------------------------------------------
-- 2. categories  – add slug, description, created_at
-- -----------------------------------------------------------------------------
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS slug       VARCHAR(100) NULL          AFTER name,
  ADD COLUMN IF NOT EXISTS description TEXT         NULL          AFTER slug,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER description;

-- Back-fill slug from name (lowercase, spaces → hyphens, strip non-alnum)
UPDATE categories
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9 ]', ''), ' +', '-'))
WHERE slug IS NULL OR slug = '';

-- Now enforce UNIQUE + NOT NULL
ALTER TABLE categories
  MODIFY COLUMN slug VARCHAR(100) NOT NULL,
  ADD UNIQUE KEY uq_categories_slug (slug);

-- -----------------------------------------------------------------------------
-- 3. products  – add sku, slug, status, updated_at, deleted_at
--    (existing image column is kept; product_images is a new additive table)
-- -----------------------------------------------------------------------------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sku        VARCHAR(80)  NULL          AFTER product_id,
  ADD COLUMN IF NOT EXISTS slug       VARCHAR(200) NULL          AFTER name,
  ADD COLUMN IF NOT EXISTS status     ENUM('active','draft','archived') NOT NULL DEFAULT 'active' AFTER description,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER updated_at;

-- Back-fill slug from name
UPDATE products
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9 ]', ''), ' +', '-'))
WHERE slug IS NULL OR slug = '';

-- Back-fill sku: 'PF-' + zero-padded product_id
UPDATE products
SET sku = CONCAT('PF-', LPAD(product_id, 5, '0'))
WHERE sku IS NULL OR sku = '';

ALTER TABLE products
  MODIFY COLUMN slug VARCHAR(200) NOT NULL,
  MODIFY COLUMN sku  VARCHAR(80)  NOT NULL,
  ADD UNIQUE KEY uq_products_slug (slug),
  ADD UNIQUE KEY uq_products_sku  (sku);

-- Indexes required by spec
ALTER TABLE products
  ADD INDEX IF NOT EXISTS idx_products_category_status (category_id, status);

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

ALTER TABLE product_images
  ADD INDEX IF NOT EXISTS idx_product_images_product (product_id);

-- -----------------------------------------------------------------------------
-- 5. orders  – add order_number, payment_status, updated_at
--    Status ENUM casing kept as-is (mixed-case) per approval.
-- -----------------------------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_number   VARCHAR(30)  NULL          AFTER order_id,
  ADD COLUMN IF NOT EXISTS payment_status ENUM('unpaid','pending_verification','paid','refunded')
    NOT NULL DEFAULT 'unpaid' AFTER is_paid,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- Back-fill order_number from order_id (format: PF-ORD-1001)
UPDATE orders
SET order_number = CONCAT('PF-ORD-', order_id)
WHERE order_number IS NULL OR order_number = '';

ALTER TABLE orders
  MODIFY COLUMN order_number VARCHAR(30) NOT NULL,
  ADD UNIQUE KEY IF NOT EXISTS uq_orders_order_number (order_number);

-- Sync payment_status from legacy is_paid flag for existing rows
UPDATE orders SET payment_status = 'paid' WHERE is_paid = 1 AND payment_status = 'unpaid';

-- Indexes required by spec
ALTER TABLE orders
  ADD INDEX IF NOT EXISTS idx_orders_user_status_created (user_id, status, created_at);

-- -----------------------------------------------------------------------------
-- 6. quote_requests  – add quote_number, phone, updated_at
-- -----------------------------------------------------------------------------
ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS quote_number VARCHAR(30) NULL          AFTER quote_id,
  ADD COLUMN IF NOT EXISTS phone        VARCHAR(30) NULL          AFTER email,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- Back-fill quote_number
UPDATE quote_requests
SET quote_number = CONCAT('PF-QT-', quote_id)
WHERE quote_number IS NULL OR quote_number = '';

ALTER TABLE quote_requests
  MODIFY COLUMN quote_number VARCHAR(30) NOT NULL,
  ADD UNIQUE KEY IF NOT EXISTS uq_quote_requests_quote_number (quote_number);

-- -----------------------------------------------------------------------------
-- 7. support_tickets  – add 'Closed' to status ENUM
-- -----------------------------------------------------------------------------
ALTER TABLE support_tickets
  MODIFY COLUMN status ENUM('Open','In Progress','Resolved','Closed') NOT NULL DEFAULT 'Open';

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

ALTER TABLE addresses
  ADD INDEX IF NOT EXISTS idx_addresses_user (user_id);

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
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS note VARCHAR(255) NULL AFTER reference_id;

ALTER TABLE stock_movements
  ADD INDEX IF NOT EXISTS idx_stock_movements_product (product_id);

-- -----------------------------------------------------------------------------
-- 11. notifications  – add composite index (user_id, is_read)
-- -----------------------------------------------------------------------------
ALTER TABLE notifications
  ADD INDEX IF NOT EXISTS idx_notifications_user_read (user_id, is_read);

-- -----------------------------------------------------------------------------
-- 12. message_replies  – add explicit index on message_id
-- -----------------------------------------------------------------------------
ALTER TABLE message_replies
  ADD INDEX IF NOT EXISTS idx_message_replies_message (message_id);

-- -----------------------------------------------------------------------------
-- 13. audit_logs  – add composite indexes
-- -----------------------------------------------------------------------------
ALTER TABLE audit_logs
  ADD INDEX IF NOT EXISTS idx_audit_logs_created_at    (created_at),
  ADD INDEX IF NOT EXISTS idx_audit_logs_entity        (entity_type, entity_id);

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================

-- =============================================================================
-- 14. categories  – parent_id, sort_order  (admin spec)
-- =============================================================================
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS parent_id  INT      NULL           AFTER category_id,
  ADD COLUMN IF NOT EXISTS sort_order SMALLINT NOT NULL DEFAULT 0 AFTER description;

ALTER TABLE categories
  ADD CONSTRAINT IF NOT EXISTS fk_cat_parent
    FOREIGN KEY (parent_id) REFERENCES categories(category_id) ON DELETE SET NULL;

-- =============================================================================
-- 15. quote_requests  – delivery_location
-- =============================================================================
ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS delivery_location VARCHAR(255) NULL AFTER message;

-- =============================================================================
-- 16. app_settings  – SMTP + business settings seed rows
-- =============================================================================
INSERT IGNORE INTO app_settings (setting_key, setting_value, description) VALUES
  ('vat_rate',           '0',   'VAT percentage applied to orders (e.g. 15 for 15%)'),
  ('delivery_fee',       '0',   'Flat delivery fee in ETB'),
  ('low_stock_threshold','5',   'Products at or below this stock level are flagged as low stock'),
  ('smtp_host',          '',    'SMTP server hostname'),
  ('smtp_port',          '587', 'SMTP server port'),
  ('smtp_user',          '',    'SMTP authentication username'),
  ('smtp_password_enc',  '',    'AES-256-GCM encrypted SMTP password (base64)'),
  ('smtp_from',          '',    'Sender address for outgoing email');
