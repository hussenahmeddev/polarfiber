/**
 * Polar Fiber – link local product images to database rows
 * Updates products.image to point at the local static file path (/images/<file>).
 *
 * Run:  node db/upload-images-to-db.mjs
 * Env:  MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_CA_CERT
 */
import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

try { process.loadEnvFile?.(); } catch {}

const __dir = path.dirname(fileURLToPath(import.meta.url));

const raw = process.env.MYSQL_CA_CERT;
if (!process.env.MYSQL_HOST || !process.env.MYSQL_PASSWORD || !raw) {
  console.error("❌  Missing env vars: MYSQL_HOST, MYSQL_PASSWORD, MYSQL_CA_CERT");
  process.exit(1);
}

const body = raw.replace(/-----(BEGIN|END) CERTIFICATE-----/g, "").replace(/\s+/g, "");
const ca   = `-----BEGIN CERTIFICATE-----\n${body.match(/.{1,64}/g).join("\n")}\n-----END CERTIFICATE-----\n`;

const c = await mysql.createConnection({
  host:     process.env.MYSQL_HOST,
  port:   +(process.env.MYSQL_PORT || 3306),
  user:     process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  ssl:    { ca },
});

console.log("▶  Linking local images to products…\n");

// Map filename → product name fragment to match DB rows.
// Keys are exact filenames (without extension); values are LIKE patterns.
const FILE_TO_PRODUCT = {
  "tanker-500l":    "500",
  "tanker-1000l":   "1,000",
  "tanker-2000l":   "2,000",
  "tanker-5000l":   "5,000",
  "tanker-10000l":  "10,000",
  "tanker-25000l":  "25,000",
  "flower-pot":     "Flower Pot",
  "roof-sheet":     "Roof Sheet",
  "fiber-pipe":     "Fiber Pipe",
};

const imagesDir = path.join(__dir, "..", "public", "images");
const files = fs.readdirSync(imagesDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

// Fetch all products once
const [allProducts] = await c.query("SELECT product_id, name, image FROM products");

let updated = 0;
let skipped = 0;

for (const file of files) {
  const stem = file.replace(/\.(jpg|jpeg|png|webp)$/i, "").toLowerCase();
  const pattern = FILE_TO_PRODUCT[stem];

  if (!pattern) {
    // Not in the explicit map — skip silently (factory photos, tanks overview, etc.)
    continue;
  }

  const match = allProducts.find(p =>
    p.name.toLowerCase().includes(pattern.toLowerCase())
  );

  if (!match) {
    console.log(`⚠️   No product matched for ${file} (pattern: "${pattern}")`);
    skipped++;
    continue;
  }

  const imageUrl = `/images/${file}`;

  await c.execute(
    "UPDATE products SET image = ? WHERE product_id = ?",
    [imageUrl, match.product_id]
  );

  console.log(`✅  ${file}  →  "${match.name}"  (product_id: ${match.product_id})`);
  updated++;
}

console.log(`\n✅  Done. Updated: ${updated}, skipped: ${skipped}.`);
await c.end();
