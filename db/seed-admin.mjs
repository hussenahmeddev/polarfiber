/**
 * Polar Fiber – admin seed script
 * Creates ONE admin account. Safe to re-run (idempotent).
 *
 * Required env vars:
 *   ADMIN_EMAIL     – e.g. admin@polarfiber.com
 *   ADMIN_NAME      – e.g. "Polar Admin"
 *   ADMIN_PASSWORD  – strong password (min 12 chars enforced here)
 *
 * Plus the standard MySQL env vars.
 *
 * Run:  node db/seed-admin.mjs
 */
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

try {
  process.loadEnvFile?.();
} catch {}

// ── Validate env ──────────────────────────────────────────────────────────────
const required = [
  "MYSQL_HOST",
  "MYSQL_PASSWORD",
  "MYSQL_CA_CERT",
  "ADMIN_EMAIL",
  "ADMIN_NAME",
  "ADMIN_PASSWORD",
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("❌  Missing env vars:", missing.join(", "));
  process.exit(1);
}

const adminEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();
const adminName = process.env.ADMIN_NAME.trim();
const adminPassword = process.env.ADMIN_PASSWORD;

if (adminPassword.length < 12) {
  console.error("❌  ADMIN_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

if (!/^\S+@\S+\.\S+$/.test(adminEmail)) {
  console.error("❌  ADMIN_EMAIL is not a valid email address.");
  process.exit(1);
}

// ── Connect ───────────────────────────────────────────────────────────────────
const raw = process.env.MYSQL_CA_CERT;
const body = raw.replace(/-----(BEGIN|END) CERTIFICATE-----/g, "").replace(/\s+/g, "");
const ca = `-----BEGIN CERTIFICATE-----\n${body.match(/.{1,64}/g).join("\n")}\n-----END CERTIFICATE-----\n`;

const c = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: +(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  ssl: { ca },
});

// ── Seed ──────────────────────────────────────────────────────────────────────
const [[existing]] = await c.execute("SELECT user_id, role FROM users WHERE email = ?", [
  adminEmail,
]);

if (existing) {
  if (existing.role === "admin") {
    console.log(`ℹ️   Admin account already exists (user_id: ${existing.user_id}). Nothing to do.`);
  } else {
    // Promote existing user to admin
    await c.execute("UPDATE users SET role = 'admin', must_change_password = 0 WHERE user_id = ?", [
      existing.user_id,
    ]);
    await c.execute(
      "INSERT INTO user_roles (user_id, role) VALUES (?, 'admin') ON DUPLICATE KEY UPDATE role = 'admin'",
      [existing.user_id],
    );
    console.log(`✅  Promoted existing user to admin (user_id: ${existing.user_id}).`);
  }
  await c.end();
  process.exit(0);
}

// Hash with cost factor 12 (appropriate for production)
const passwordHash = await bcrypt.hash(adminPassword, 12);

const [res] = await c.execute(
  `INSERT INTO users (name, email, phone, password_hash, role, is_active, must_change_password)
   VALUES (?, ?, '', ?, 'admin', 1, 0)`,
  [adminName, adminEmail, passwordHash],
);

const userId = res.insertId;

await c.execute(
  "INSERT INTO user_roles (user_id, role) VALUES (?, 'admin') ON DUPLICATE KEY UPDATE role = 'admin'",
  [userId],
);

console.log(`✅  Admin account created.`);
console.log(`   user_id : ${userId}`);
console.log(`   email   : ${adminEmail}`);
console.log(`   name    : ${adminName}`);
// Never log the password — not even a masked version

await c.end();
