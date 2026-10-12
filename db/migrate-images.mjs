/**
 * Polar Fiber – add has_db_image column to products
 * Run:  node db/migrate-images.mjs
 */
import mysql from "mysql2/promise";

try { process.loadEnvFile?.(); } catch {}

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

console.log("▶  Running product_images migration…");
try {
  // Check if column already exists before adding
  const [cols] = await c.query("SHOW COLUMNS FROM products LIKE 'has_db_image'");
  if (cols.length > 0) {
    console.log("ℹ️   Column has_db_image already exists. Nothing to do.");
  } else {
    await c.execute(
      "ALTER TABLE products ADD COLUMN has_db_image TINYINT(1) NOT NULL DEFAULT 0"
    );
    console.log("✅  Migration complete. products.has_db_image column added.");
  }
} catch (err) {
  console.error("❌  Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
