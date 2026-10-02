import mysql from "mysql2/promise";

// Aiven's CA can arrive with newlines collapsed to spaces; rebuild a valid PEM.
function normalizeCa(raw: string) {
  const body = raw.replace(/-----(BEGIN|END) CERTIFICATE-----/g, "").replace(/\s+/g, "");
  return `-----BEGIN CERTIFICATE-----\n${body.match(/.{1,64}/g)!.join("\n")}\n-----END CERTIFICATE-----\n`;
}

export async function withDb<T>(fn: (c: mysql.Connection) => Promise<T>): Promise<T> {
  const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_CA_CERT } = process.env;
  if (!MYSQL_HOST || !MYSQL_PASSWORD || !MYSQL_CA_CERT) throw new Error("Database is not configured.");
  const c = await mysql.createConnection({
    host: MYSQL_HOST, port: Number(MYSQL_PORT ?? 3306), user: MYSQL_USER, password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE, ssl: { ca: normalizeCa(MYSQL_CA_CERT) }, decimalNumbers: true, dateStrings: true,
  });
  try { return await fn(c); } finally { await c.end().catch(() => {}); }
}

export async function rows<T>(c: mysql.Connection, sql: string, params: unknown[] = []): Promise<T[]> {
  const [r] = await c.execute(sql, params as never);
  return r as T[];
}
