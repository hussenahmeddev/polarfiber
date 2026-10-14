export const ORDER_NUMBER_PREFIX = "PF-ORD-";

/** Uppercases/trims a user-supplied order number so "pf-ord-1009" works. */
export function normalizeOrderNumber(input: unknown): string {
  const raw = typeof input === "string" ? input : typeof input === "number" ? String(input) : "";
  return raw.trim().toUpperCase();
}

/**
 * Accepts "1009", "PF-ORD-1009" or 1009 and returns the numeric order id.
 * Returns null for anything else, so a malformed value never reaches a query.
 */
export function parseOrderId(input: unknown): number | null {
  const s = normalizeOrderNumber(input);
  if (!s) return null;
  const m = s.match(/^(?:PF-ORD-)?(\d{1,10})$/);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Case-insensitive email comparison (DB stores lower-cased). */
export function isEmailMatch(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Builds the public order number from an id. */
export function toOrderNumber(orderId: number): string {
  return `${ORDER_NUMBER_PREFIX}${orderId}`;
}
