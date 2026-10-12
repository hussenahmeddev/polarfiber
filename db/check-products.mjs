import mysql from "mysql2/promise";
try { process.loadEnvFile?.(); } catch {}

const body = process.env.MYSQL_CA_CERT
  .replace(/-----(BEGIN|END) CERTIFICATE-----/g, "")
  .replace(/\s+/g, "");
const ca = `-----BEGIN CERTIFICATE-----\n${body.match(/.{1,64}/g).join("\n")}\n-----END CERTIFICATE-----\n`;

const c = await mysql.createConnection({
  host:     process.env.MYSQL_HOST,
  port:   +(process.env.MYSQL_PORT || 3306),
  user:     process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  ssl:    { ca },
});

// Show actual columns in products table
const [cols] = await c.query("SHOW COLUMNS FROM products");
console.log("\n=== products table columns ===");
console.log(cols.map(c => c.Field).join(", "));

// Show products with base columns only
const [products] = await c.query(
  "SELECT product_id, name, image FROM products ORDER BY product_id"
);
console.log(`\n=== Products (${products.length} rows) ===`);
for (const p of products) {
  console.log(`  [${p.product_id}] ${p.name} | image=${p.image}`);
}

// Simulate the public query
const [pub] = await c.query(`
  SELECT p.product_id, p.name, c.name AS category
  FROM products p JOIN categories c ON c.category_id = p.category_id
  ORDER BY p.product_id
`);
console.log(`\n=== Public query: ${pub.length} product(s) ===`);
for (const p of pub) console.log(`  [${p.product_id}] ${p.name} (${p.category})`);

await c.end();
