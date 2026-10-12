/**
 * Polar Fiber – forward migration runner
 * Run:  node db/migrate.mjs
 * Env:  MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_CA_CERT
 */
import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

try {
  process.loadEnvFile?.();
} catch {}

const __dir = path.dirname(fileURLToPath(import.meta.url));

const raw = process.env.MYSQL_CA_CERT;
if (!process.env.MYSQL_HOST || !process.env.MYSQL_PASSWORD || !raw) {
  console.error("❌  Missing env vars: MYSQL_HOST, MYSQL_PASSWORD, MYSQL_CA_CERT");
  process.exit(1);
}

const body = raw.replace(/-----(BEGIN|END) CERTIFICATE-----/g, "").replace(/\s+/g, "");
const ca = `-----BEGIN CERTIFICATE-----\n${body.match(/.{1,64}/g).join("\n")}\n-----END CERTIFICATE-----\n`;

const c = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: +(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  ssl: { ca },
  multipleStatements: true,
});

const sql = fs.readFileSync(path.join(__dir, "migrate.sql"), "utf8");
const customerMessagesSql = fs.readFileSync(path.join(__dir, "add-customer-messages.sql"), "utf8");

console.log("▶  Running forward migration…");
try {
  await c.query(sql);
  await c.query(customerMessagesSql);
  console.log("✅  Migration complete.");
} catch (err) {
  console.error("❌  Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
