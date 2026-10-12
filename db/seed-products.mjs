/**
 * Polar Fiber – product seed script
 * Seeds sample products into the database. Safe to re-run (idempotent).
 *
 * Run:  node db/seed-products.mjs
 *
 * Pass --force to re-insert even if products already exist.
 * Pass --clear to delete all products first (use with caution).
 */
import mysql from "mysql2/promise";

try {
  process.loadEnvFile?.();
} catch {}

const force = process.argv.includes("--force");
const clear = process.argv.includes("--clear");

// ── Connect ───────────────────────────────────────────────────────────────────
const required = ["MYSQL_HOST", "MYSQL_PASSWORD", "MYSQL_CA_CERT"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("❌  Missing env vars:", missing.join(", "));
  process.exit(1);
}

const raw = process.env.MYSQL_CA_CERT;
const body = raw.replace(/-----(BEGIN|END) CERTIFICATE-----/g, "").replace(/\s+/g, "");
const ca = `-----BEGIN CERTIFICATE-----\n${body.match(/.{1,64}/g).join("\n")}\n-----END CERTIFICATE-----\n`;

const c = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: +(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "avnadmin",
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || "defaultdb",
  ssl: { ca },
});

// ── Check existing count ──────────────────────────────────────────────────────
const [[{ n }]] = await c.query("SELECT COUNT(*) n FROM products");

if (n > 0 && !force && !clear) {
  console.log(`ℹ️   Products already exist (${n} rows). Use --force to re-seed or --clear to wipe first.`);
  await c.end();
  process.exit(0);
}

if (clear) {
  console.log("⚠️   Clearing all products (--clear flag)...");
  await c.query("DELETE FROM order_items WHERE product_id IS NOT NULL");
  await c.query("DELETE FROM products");
  console.log("✅  Products table cleared.");
}

// ── Seed data ─────────────────────────────────────────────────────────────────
// Images use the real Polar Fiber WordPress site URLs.
// If those are unavailable, swap in any reachable HTTPS image URL.
const IMG = "https://polarfiber.com.et/wp-content/uploads";

const PRODUCTS = [
  // Water Tankers
  {
    category: "Water Tankers",
    name: "Polar Tanker 500L",
    capacity: "500 L",
    price: 6500,
    stock: 40,
    image: `${IMG}/2025/06/IMG_9883-768x512.jpg`,
    description: "Compact rotomolded tank for households. UV-stabilized, food-grade LLDPE.",
  },
  {
    category: "Water Tankers",
    name: "Polar Tanker 1,000L",
    capacity: "1,000 L",
    price: 11500,
    stock: 32,
    image: `${IMG}/2025/06/IMG_0110-768x512.jpg`,
    description: "Our most popular home tank. Seamless body with secure locking lid.",
  },
  {
    category: "Water Tankers",
    name: "Polar Tanker 2,000L",
    capacity: "2,000 L",
    price: 21000,
    stock: 18,
    image: `${IMG}/2025/06/IMG_9884-768x512.jpg`,
    description: "For larger homes and small businesses. Withstands -10°C to 60°C.",
  },
  {
    category: "Water Tankers",
    name: "Polar Tanker 5,000L",
    capacity: "5,000 L",
    price: 48000,
    stock: 9,
    image: `${IMG}/2025/06/IMG_9968-768x512.jpg`,
    description: "Commercial and agricultural storage with reinforced walls.",
  },
  {
    category: "Water Tankers",
    name: "Polar Tanker 10,000L",
    capacity: "10,000 L",
    price: 92000,
    stock: 4,
    image: `${IMG}/2025/06/IMG_0100-768x512.jpg`,
    description: "Industrial-capacity tank. Delivery and installation advice included.",
  },
  {
    category: "Water Tankers",
    name: "Polar Tanker 25,000L",
    capacity: "25,000 L",
    price: 215000,
    stock: 0,
    image: `${IMG}/2025/06/IMG_9893-768x512.jpg`,
    description: "Made to order for factories, farms and institutions.",
  },
  // Flower Pots
  {
    category: "Flower Pots",
    name: "Garden Flower Pot (Small)",
    capacity: null,
    price: 900,
    stock: 120,
    image: `${IMG}/2025/06/photo_5978789373514205707_y-768x355.jpg`,
    description: "Durable molded pot for indoor and outdoor plants. Lightweight and UV-resistant.",
  },
  {
    category: "Flower Pots",
    name: "Garden Flower Pot (Large)",
    capacity: null,
    price: 1600,
    stock: 80,
    image: `${IMG}/2025/06/photo_5978789373514205707_y-768x355.jpg`,
    description: "Large decorative pot for gardens and patios. Made from recycled fiber.",
  },
  // Roof Sheets
  {
    category: "Roof Sheets",
    name: "Fiber Roof Sheet (Standard)",
    capacity: null,
    price: 1800,
    stock: 300,
    image: `${IMG}/2025/06/photo_5978789373514205748_y-768x355.jpg`,
    description: "Lightweight, weather-resistant roofing sheet. Ideal for residential use.",
  },
  {
    category: "Roof Sheets",
    name: "Fiber Roof Sheet (Heavy Duty)",
    capacity: null,
    price: 2600,
    stock: 150,
    image: `${IMG}/2025/06/photo_5978789373514205748_y-768x355.jpg`,
    description: "Reinforced roofing sheet for commercial and industrial buildings.",
  },
  // Fiber Pipes
  {
    category: "Fiber Pipes",
    name: 'Fiber Pipe 4"',
    capacity: null,
    price: 2400,
    stock: 75,
    image: `${IMG}/2025/11/20230402_102116-768x359.jpg`,
    description: "Strong 4-inch fiber pipe for water lines and drainage systems.",
  },
  {
    category: "Fiber Pipes",
    name: 'Fiber Pipe 6"',
    capacity: null,
    price: 3800,
    stock: 50,
    image: `${IMG}/2025/11/20230402_102116-768x359.jpg`,
    description: "6-inch heavy-duty fiber pipe for main supply and sewage lines.",
  },
];

// ── Check if migration has run (products table has sku/slug/status columns) ──
const [cols] = await c.query("SHOW COLUMNS FROM products");
const colNames = new Set(cols.map((r) => r.Field));
const hasMigrationCols = colNames.has("sku") && colNames.has("slug") && colNames.has("status");

console.log(`ℹ️   Migration columns present: ${hasMigrationCols ? "yes (sku, slug, status)" : "no — basic schema only"}`);

let inserted = 0;
let skipped = 0;

for (const p of PRODUCTS) {
  // Check if this product already exists by name
  const [[exists]] = await c.query("SELECT product_id FROM products WHERE name = ?", [p.name]);
  if (exists && !force) {
    skipped++;
    continue;
  }

  if (hasMigrationCols) {
    // Generate a slug from the name
    const slug = p.name
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, "-");

    await c.execute(
      `INSERT INTO products (category_id, name, capacity, price, stock, image, description, status, slug, sku)
       SELECT c.category_id, ?, ?, ?, ?, ?, ?, 'active', ?, CONCAT('PF-', LPAD(FLOOR(RAND()*99999+1), 5, '0'))
       FROM categories c WHERE c.name = ?
       ON DUPLICATE KEY UPDATE
         price = VALUES(price),
         stock = VALUES(stock),
         image = VALUES(image),
         description = VALUES(description),
         status = 'active'`,
      [p.name, p.capacity, p.price, p.stock, p.image, p.description, slug, p.category],
    );
  } else {
    await c.execute(
      `INSERT INTO products (category_id, name, capacity, price, stock, image, description)
       SELECT c.category_id, ?, ?, ?, ?, ?, ?
       FROM categories c WHERE c.name = ?`,
      [p.name, p.capacity, p.price, p.stock, p.image, p.description, p.category],
    );
  }
  inserted++;
  console.log(`  ✅  ${p.name} (${p.category}) — ETB ${p.price.toLocaleString()}`);
}

const [[{ total }]] = await c.query("SELECT COUNT(*) total FROM products");
console.log(`\n✅  Done. Inserted: ${inserted}, skipped: ${skipped}, total products: ${total}`);
await c.end();
