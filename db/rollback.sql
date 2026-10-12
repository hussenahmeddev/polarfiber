-- =============================================================================
-- Polar Fiber – rollback migration
-- Reverses db/migrate.sql. Run: node db/rollback.mjs
-- WARNING: dropping indexes is always safe; dropping columns loses data.
-- Columns added by the migration are dropped here. Original columns are untouched.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 14. customer_conversations & customer_messages  – drop tables (additive, safe to drop)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS customer_messages;
DROP TABLE IF EXISTS customer_conversations;

-- -----------------------------------------------------------------------------
-- 13. audit_logs  – remove indexes
-- -----------------------------------------------------------------------------
ALTER TABLE audit_logs
  DROP INDEX IF EXISTS idx_audit_logs_created_at,
  DROP INDEX IF EXISTS idx_audit_logs_entity;

-- -----------------------------------------------------------------------------
-- 12. message_replies  – remove index
-- -----------------------------------------------------------------------------
ALTER TABLE message_replies
  DROP INDEX IF EXISTS idx_message_replies_message;

-- -----------------------------------------------------------------------------
-- 11. notifications  – remove index
-- -----------------------------------------------------------------------------
ALTER TABLE notifications
  DROP INDEX IF EXISTS idx_notifications_user_read;

-- -----------------------------------------------------------------------------
-- 10. stock_movements  – remove note column, remove index
-- -----------------------------------------------------------------------------
ALTER TABLE stock_movements
  DROP INDEX IF EXISTS idx_stock_movements_product,
  DROP COLUMN IF EXISTS note;

-- -----------------------------------------------------------------------------
-- 9. favorites  – drop table (additive, safe to drop)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS favorites;

-- -----------------------------------------------------------------------------
-- 8. addresses  – drop table (additive, safe to drop)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS addresses;

-- -----------------------------------------------------------------------------
-- 7. support_tickets  – revert status ENUM (remove 'Closed')
-- -----------------------------------------------------------------------------
-- Set any 'Closed' tickets back to 'Resolved' before shrinking the ENUM
UPDATE support_tickets SET status = 'Resolved' WHERE status = 'Closed';
ALTER TABLE support_tickets
  MODIFY COLUMN status ENUM('Open','In Progress','Resolved') NOT NULL DEFAULT 'Open';

-- -----------------------------------------------------------------------------
-- 6. quote_requests  – remove quote_number, phone, updated_at
-- -----------------------------------------------------------------------------
ALTER TABLE quote_requests
  DROP INDEX IF EXISTS uq_quote_requests_quote_number,
  DROP COLUMN IF EXISTS quote_number,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS updated_at;

-- -----------------------------------------------------------------------------
-- 5. orders  – remove order_number, payment_status, updated_at
-- -----------------------------------------------------------------------------
ALTER TABLE orders
  DROP INDEX IF EXISTS uq_orders_order_number,
  DROP INDEX IF EXISTS idx_orders_user_status_created,
  DROP COLUMN IF EXISTS order_number,
  DROP COLUMN IF EXISTS payment_status,
  DROP COLUMN IF EXISTS updated_at;

-- -----------------------------------------------------------------------------
-- 4. product_images  – drop table (additive, safe to drop)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS product_images;

-- -----------------------------------------------------------------------------
-- 3. products  – remove sku, slug, status, updated_at, deleted_at
-- -----------------------------------------------------------------------------
ALTER TABLE products
  DROP INDEX IF EXISTS uq_products_slug,
  DROP INDEX IF EXISTS uq_products_sku,
  DROP INDEX IF EXISTS idx_products_category_status,
  DROP COLUMN IF EXISTS sku,
  DROP COLUMN IF EXISTS slug,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS deleted_at;

-- -----------------------------------------------------------------------------
-- 2. categories  – remove slug, description, created_at
-- -----------------------------------------------------------------------------
ALTER TABLE categories
  DROP INDEX IF EXISTS uq_categories_slug,
  DROP COLUMN IF EXISTS slug,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS created_at;

-- -----------------------------------------------------------------------------
-- 1. users  – remove updated_at, deleted_at
-- -----------------------------------------------------------------------------
ALTER TABLE users
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS deleted_at;

-- =============================================================================
-- END OF ROLLBACK
-- =============================================================================
