-- Update product images to use local paths instead of external URLs
-- Run this after downloading images to public/images/

UPDATE products SET image = '/images/tanker-500l.jpg' WHERE name = 'Polar Tanker 500L';
UPDATE products SET image = '/images/tanker-1000l.jpg' WHERE name = 'Polar Tanker 1,000L';
UPDATE products SET image = '/images/tanker-2000l.jpg' WHERE name = 'Polar Tanker 2,000L';
UPDATE products SET image = '/images/tanker-5000l.jpg' WHERE name = 'Polar Tanker 5,000L';
UPDATE products SET image = '/images/tanker-10000l.jpg' WHERE name = 'Polar Tanker 10,000L';
UPDATE products SET image = '/images/tanker-25000l.jpg' WHERE name = 'Polar Tanker 25,000L';
UPDATE products SET image = '/images/flower-pot.jpg' WHERE name = 'Garden Flower Pot';
UPDATE products SET image = '/images/roof-sheet.jpg' WHERE name = 'Fiber Roof Sheet';
UPDATE products SET image = '/images/fiber-pipe.jpg' WHERE name = 'Fiber Pipe 4"';

-- Verify the updates
SELECT product_id, name, image FROM products ORDER BY product_id;