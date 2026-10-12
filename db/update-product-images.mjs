/**
 * Update product images to local paths
 * Run: node db/update-product-images.mjs
 * Env: MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_CA_CERT
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
  host:               process.env.MYSQL_HOST,
  port:             +(process.env.MYSQL_PORT || 3306),
  user:               process.env.MYSQL_USER,
  password:           process.env.MYSQL_PASSWORD,
  database:           process.env.MYSQL_DATABASE,
  ssl:              { ca },
  multipleStatements: true,
});

const sql = fs.readFileSync(path.join(__dir, "update-product-images.sql"), "utf8");

console.log("▶  Updating product images to local paths…");
try {
  await c.query(sql);
  console.log("✅  Product images updated successfully.");
} catch (err) {
  console.error("❌  Update failed:", err.message);
  process.exitCode = 1;
} finally {
  await c.end();
}