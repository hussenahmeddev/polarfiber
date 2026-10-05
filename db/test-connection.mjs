// Quick test: verify Aiven MySQL connectivity. Run: node db/test-connection.mjs
import mysql from "mysql2/promise";

try {
  process.loadEnvFile?.();
} catch {}

const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_CA_CERT } =
  process.env;

if (!MYSQL_HOST || !MYSQL_PASSWORD || !MYSQL_CA_CERT) {
  console.error(
    "❌ Missing env vars. Make sure MYSQL_HOST, MYSQL_PASSWORD, and MYSQL_CA_CERT are set.",
  );
  console.error("   Copy .env.example to .env and fill in your Aiven credentials.");
  process.exit(1);
}

// Normalize CA cert (Aiven sometimes collapses newlines)
const body = MYSQL_CA_CERT.replace(/-----(BEGIN|END) CERTIFICATE-----/g, "").replace(/\s+/g, "");
const ca = `-----BEGIN CERTIFICATE-----\n${body.match(/.{1,64}/g).join("\n")}\n-----END CERTIFICATE-----\n`;

try {
  console.log(`⏳ Connecting to ${MYSQL_HOST}:${MYSQL_PORT || 3306}...`);
  const c = await mysql.createConnection({
    host: MYSQL_HOST,
    port: +(MYSQL_PORT || 3306),
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    ssl: { ca },
  });

  const [[{ ver }]] = await c.query("SELECT VERSION() AS ver");
  console.log(`✅ Connected! MySQL version: ${ver}`);

  // Check for tables
  const [tables] = await c.query("SHOW TABLES");
  if (tables.length === 0) {
    console.log("⚠️  No tables found. Run: node db/setup.mjs to create tables and seed data.");
  } else {
    console.log(`📋 Tables: ${tables.map((t) => Object.values(t)[0]).join(", ")}`);
    const [[{ n }]] = await c.query("SELECT COUNT(*) n FROM products");
    console.log(`📦 Products: ${n}`);
    const [[{ u }]] = await c.query("SELECT COUNT(*) u FROM users");
    console.log(`👥 Users: ${u}`);
  }

  await c.end();
  console.log("\n🎉 Database connection verified successfully!");
} catch (err) {
  console.error(`❌ Connection failed: ${err.message}`);
  if (err.code === "ENOTFOUND") console.error("   → Check MYSQL_HOST — hostname not found.");
  if (err.code === "ECONNREFUSED") console.error("   → Check MYSQL_PORT — connection refused.");
  if (err.message.includes("SSL"))
    console.error("   → Check MYSQL_CA_CERT — SSL certificate issue.");
  process.exit(1);
}
