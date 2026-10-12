-- Add has_db_image column to products (safe to re-run)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS has_db_image TINYINT(1) NOT NULL DEFAULT 0;
