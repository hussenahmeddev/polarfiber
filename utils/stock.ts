import type mysql from "mysql2/promise";
import { rows } from "../backend/db.server";

/**
 * changeStock — the single authoritative function for all stock mutations.
 *
 * MUST be called inside an existing transaction (the caller owns BEGIN/COMMIT/ROLLBACK).
 * The function:
 *   1. Locks the product row with SELECT … FOR UPDATE (prevents race conditions).
 *   2. Computes the new stock value.
 *   3. Throws if the result would go below zero (never silently clips to 0).
 *   4. Writes the UPDATE to products.
 *   5. Inserts a stock_movements row for a full audit trail.
 *
 * @param c         — open mysql2 Connection (inside a transaction)
 * @param productId — products.product_id
 * @param delta     — signed integer: positive = stock in, negative = stock out
 * @param reason    — free-text description stored in stock_movements.note
 * @param refType   — reference_type column value, e.g. 'order', 'manual', 'admin_edit'
 * @param refId     — reference_id column value (order_id, user_id, adjustment_id …)
 * @param userId    — actor performing the change (for movements.reference_id on manual)
 * @returns         — the new stock value
 */
export async function changeStock(
  c: mysql.Connection,
  productId: number,
  delta: number,
  reason: string,
  refType: string,
  refId: number | string,
  userId: number,
): Promise<number> {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error(`changeStock: delta must be a non-zero integer, got ${delta}`);
  }

  // Lock the row so concurrent requests cannot read a stale stock value
  const locked = await rows<{ stock: number; name: string }>(
    c,
    "SELECT stock, name FROM products WHERE product_id = ? FOR UPDATE",
    [productId],
  );
  if (!locked[0]) throw new Error(`Product ${productId} not found.`);

  const currentStock = locked[0].stock;
  const newStock = currentStock + delta;

  if (newStock < 0) {
    throw new Error(
      `Insufficient stock for "${locked[0].name}". ` +
        `Available: ${currentStock}, requested: ${Math.abs(delta)}.`,
    );
  }

  await c.execute("UPDATE products SET stock = ? WHERE product_id = ?", [newStock, productId]);

  await c.execute(
    `INSERT INTO stock_movements
       (product_id, quantity, type, reference_type, reference_id, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [productId, Math.abs(delta), delta > 0 ? "in" : "out", refType, String(refId), reason],
  );

  return newStock;
}

export default changeStock;
