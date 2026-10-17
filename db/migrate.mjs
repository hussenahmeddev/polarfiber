/**
 * Polar Fiber – forward migration runner (MySQL 8 compatible, idempotent)
 * Run:  node db/migrate.mjs
 * Env:  MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_CA_CERT
 *
 * MySQL (unlike MariaDB) has no ADD COLUMN IF NOT EXISTS / ADD INDEX IF NOT EXISTS,
 * so migrate.sql uses plain ALTER TABLE statements. To keep the migration safe to
 * re-run, each statement is executed on its own and "already applied" errors
 * (duplicate column / duplicate key / duplicate table) are skipped.
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

// ─── SQL statement splitter ────────────────────────────────────────────────────
// Strips comments (outside string literals) then splits on ';' (outside strings).
function stripComments(sql) {
  let out = "";
  let inString = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i++;
        continue;
      }
      if (ch === "'") {
        if (next === "'") {
          out += next;
          i++;
          continue;
        }
        inString = false;
      }
      continue;
    }
    if (ch === "'") {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i++;
      continue;
    }
    out += ch;
  }
  return out;
}

function splitStatements(sql) {
  const clean = stripComments(sql);
  const stmts = [];
  let cur = "";
  let inString = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    cur += ch;
    if (inString) {
      if (ch === "\\") {
        cur += clean[i + 1] ?? "";
        i++;
        continue;
      }
      if (ch === "'") {
        if (clean[i + 1] === "'") {
          cur += clean[i + 1];
          i++;
          continue;
        }
        inString = false;
      }
      continue;
    }
    if (ch === "'") {
      inString = true;
      continue;
    }
    if (ch === ";") {
      stmts.push(cur.slice(0, -1));
      cur = "";
    }
  }
  const tail = cur.trim();
  if (tail) stmts.push(tail);
  return stmts.map((s) => s.trim()).filter(Boolean);
}

// MySQL errors that mean "this change was already applied" — safe to skip.
const ALREADY_APPLIED = new Set([
  1050, // ER_TABLE_EXISTS_ERROR
  1060, // ER_DUP_FIELDNAME            (column already exists)
  1061, // ER_DUP_KEYNAME              (index already exists)
  1062, // ER_DUP_ENTRY                (seeded row already exists)
  1091, // ER_CANT_DROP_FIELD_OR_KEY   (index/constraint already gone)
  1826, // ER_FK_DUP_NAME              (foreign key already exists)
  1005, // ER_CANT_CREATE_TABLE        (constraint/index already present)
]);

let applied = 0;
let skipped = 0;
let failed = 0;

async function runFile(label, file) {
  console.log(`▶  ${label}`);
  const sql = fs.readFileSync(path.join(__dir, file), "utf8");
  for (const stmt of splitStatements(sql)) {
    const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
    try {
      await c.query(stmt);
      applied++;
    } catch (err) {
      const code = Number(err?.errno ?? err?.code ?? 0);
      if (ALREADY_APPLIED.has(code)) {
        skipped++;
        console.log(`   ↷ already applied: ${preview}`);
        continue;
      }
      if (code === 1146 || code === 1049) {
        // ER_NO_SUCH_TABLE / ER_BAD_DB_ERROR — base schema not present
        console.error(`\n❌  ${err.message}`);
        console.error(`    on: ${preview}`);
        console.error("    Your database is missing base tables. Create them first with db/schema.sql:\n");
        console.error("      mysql --host <host> -u <user> -p <database> < db/schema.sql\n");
        failed++;
        process.exitCode = 1;
        return;
      }
      failed++;
      process.exitCode = 1;
      console.error(`\n❌  ${err.message}\n    on: ${preview}`);
    }
  }
}

try {
  await runFile("Running forward migration…", "migrate.sql");
  await runFile("Running customer messages migration…", "add-customer-messages.sql");
  await runFile("Running conversation links migration…", "customer-conversation-links.sql");
  if (failed === 0) {
    console.log(`\n✅  Migration complete — ${applied} statement(s) applied, ${skipped} already present.`);
    console.log("    Guest checkout now works: orders.user_id is nullable and order_access exists.");
  } else {
    console.error(
      `\n⚠️  Migration finished with ${failed} error(s) — ${applied} applied, ${skipped} already present.`,
    );
  }
} finally {
  await c.end();
}
