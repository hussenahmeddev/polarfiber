// One-off: create tables and seed sample products. Run: node db/setup.mjs
import mysql from "mysql2/promise";
import fs from "node:fs";

try {
  process.loadEnvFile?.();
} catch {}

const raw = process.env.MYSQL_CA_CERT;
if (!process.env.MYSQL_HOST || !process.env.MYSQL_PASSWORD || !raw) {
  console.error(
    "❌ Missing env vars. Please configure .env with MYSQL_HOST, MYSQL_PASSWORD, MYSQL_CA_CERT.",
  );
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
await c.query(fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));

const [[{ n }]] = await c.query("SELECT COUNT(*) n FROM products");
if (n === 0) {
  const IMG = "https://polarfiber.com.et/wp-content/uploads";
  const P = [
    [
      "Water Tankers",
      "Polar Tanker 500L",
      "500 L",
      6500,
      40,
      `${IMG}/2025/06/IMG_9883-768x512.jpg`,
      "Compact rotomolded tank for households. UV-stabilized, food-grade LLDPE.",
    ],
    [
      "Water Tankers",
      "Polar Tanker 1,000L",
      "1,000 L",
      11500,
      32,
      `${IMG}/2025/06/IMG_0110-768x512.jpg`,
      "Our most popular home tank. Seamless body with secure locking lid.",
    ],
    [
      "Water Tankers",
      "Polar Tanker 2,000L",
      "2,000 L",
      21000,
      18,
      `${IMG}/2025/06/IMG_9884-768x512.jpg`,
      "For larger homes and small businesses. Withstands -10°C to 60°C.",
    ],
    [
      "Water Tankers",
      "Polar Tanker 5,000L",
      "5,000 L",
      48000,
      9,
      `${IMG}/2025/06/IMG_9968-768x512.jpg`,
      "Commercial and agricultural storage with reinforced walls.",
    ],
    [
      "Water Tankers",
      "Polar Tanker 10,000L",
      "10,000 L",
      92000,
      4,
      `${IMG}/2025/06/IMG_0100-768x512.jpg`,
      "Industrial-capacity tank. Delivery and installation advice included.",
    ],
    [
      "Water Tankers",
      "Polar Tanker 25,000L",
      "25,000 L",
      215000,
      0,
      `${IMG}/2025/06/IMG_9893-768x512.jpg`,
      "Made to order for factories, farms and institutions.",
    ],
    [
      "Flower Pots",
      "Garden Flower Pot",
      null,
      900,
      120,
      `${IMG}/2025/06/photo_5978789373514205707_y-768x355.jpg`,
      "Durable molded pot for indoor and outdoor plants.",
    ],
    [
      "Roof Sheets",
      "Fiber Roof Sheet",
      null,
      1800,
      300,
      `${IMG}/2025/06/photo_5978789373514205748_y-768x355.jpg`,
      "Lightweight, weather-resistant roofing sheet.",
    ],
    [
      "Fiber Pipes",
      'Fiber Pipe 4"',
      null,
      2400,
      75,
      `${IMG}/2025/11/20230402_102116-768x359.jpg`,
      "Strong fiber pipe for water lines and drainage.",
    ],
  ];
  for (const [cat, ...r] of P) {
    await c.execute(
      "INSERT INTO products (category_id,name,capacity,price,stock,image,description) SELECT category_id,?,?,?,?,?,? FROM categories WHERE name=?",
      [...r, cat],
    );
  }
}
const [t] = await c.query("SHOW TABLES");
console.log("tables:", t.map((x) => Object.values(x)[0]).join(", "));
const [[{ p }]] = await c.query("SELECT COUNT(*) p FROM products");
console.log("products:", p);
await c.end();
