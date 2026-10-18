import { createServerFn } from "@tanstack/react-start";
import {
  getCookie,
  deleteCookie,
  getRequestHeader,
  getRequestIP,
} from "@tanstack/react-start/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import type mysql from "mysql2/promise";
import { withDb, rows } from "./db.server";
import {
  currentUser,
  endSession,
  endOrderSession,
  loadUser,
  orderSessionOrderId,
  requireAdmin,
  requirePermission,
  requireUser,
  startOrderSession,
  startSession,
  issueTokenPair,
  revokeRefreshToken,
  rotateRefreshToken,
} from "./session.server";
import { rateLimit, resetRateLimit } from "../utils/rate-limit";
import { isMessageLengthValid, preview, sanitizeMessage } from "../utils/sanitize";
import { isEmailMatch, parseOrderId } from "../shared/order-access";
import { InvalidTransitionError, canTransition, nextStatuses } from "../shared/order-status";
import type {
  Category,
  Order,
  OrderStatus,
  Product,
  Quote,
  QuoteStatus,
  Role,
  StockAdjustment,
  ContactMessage,
  SupportTicket,
} from "../shared/data";
import { CATEGORIES, ORDER_STATUSES, QUOTE_STATUSES } from "../shared/data";
import { getPermissionsForRole } from "../shared/permissions";
import { notify } from "../utils/notify";
import { logAction } from "../utils/audit";
import { changeStock } from "../utils/stock";
import { encryptSmtpPassword } from "../utils/crypto";
import {
  generateConversationToken,
  conversationTokenExpiry,
  CONVERSATION_TOKEN_VALID_DAYS,
  type ConversationType,
} from "../utils/conversation-tokens";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/cloudinary";

const PRODUCT_SQL = `SELECT p.product_id,p.name,c.name category,p.capacity,p.price,p.stock,p.image,p.description
  FROM products p JOIN categories c ON c.category_id=p.category_id`;

// PUBLIC_PRODUCT_SQL is the same as PRODUCT_SQL until migrate.sql is run
// (status/deleted_at/sku/slug columns are added by migration).
const PUBLIC_PRODUCT_SQL = PRODUCT_SQL;

// ─── IP rate-limiting for login ──────────────────────────────────────────────
const ipAttempts = new Map<string, { count: number; resetAt: number }>();

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipAttempts.get(ip);
  if (!entry || entry.resetAt < now) return false; // no limit hit
  return entry.count >= 5;
}

function recordIpAttempt(ip: string): void {
  const now = Date.now();
  const entry = ipAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    ipAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
  } else {
    entry.count++;
  }
}

function resetIpAttempts(ip: string): void {
  ipAttempts.delete(ip);
}

function getClientIp(): string {
  try {
    const ip = getRequestIP?.();
    if (ip) return ip;
    const fwd = getRequestHeader?.("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]?.trim() || "0.0.0.0";
    const realIp = getRequestHeader?.("x-real-ip");
    if (realIp) return realIp;
  } catch {
    // fallback if called outside request context
  }
  return "0.0.0.0";
}

function getUserAgent(): string {
  try {
    return getRequestHeader?.("user-agent") ?? "";
  } catch {
    return "";
  }
}

// ---------- catalog ----------
export const getProducts = createServerFn({ method: "GET" }).handler(async () =>
  withDb(async (c) => {
    try {
      return await rows<Product>(
        c,
        `${PRODUCT_SQL} WHERE (p.status = 'active' OR p.status IS NULL) AND p.deleted_at IS NULL AND c.is_active = 1 ORDER BY p.product_id`,
      );
    } catch {
      return await rows<Product>(c, `${PRODUCT_SQL} ORDER BY p.product_id`);
    }
  }),
);

export const getProduct = createServerFn({ method: "POST" })
  .validator((d) => z.object({ id: z.coerce.number().int() }).parse(d))
  .handler(async ({ data }) =>
    withDb(async (c) => {
      try {
        const [p] = await rows<Product>(
          c,
          `${PRODUCT_SQL} WHERE p.product_id=? AND (p.status = 'active' OR p.status IS NULL) AND p.deleted_at IS NULL AND c.is_active = 1`,
          [data.id],
        );
        return p ?? null;
      } catch {
        const [p] = await rows<Product>(c, `${PRODUCT_SQL} WHERE p.product_id=?`, [data.id]);
        return p ?? null;
      }
    }),
  );

// ---------- product images (served from database BLOBs) ----------
export const getProductImage = createServerFn({ method: "GET" })
  .validator((d) => z.object({ id: z.coerce.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const imgRows = await withDb((c) =>
      rows<{ image_data: string | Buffer; mime_type: string }>(
        c,
        "SELECT image_data, mime_type FROM product_images WHERE product_id = ? AND is_primary = 1 LIMIT 1",
        [data.id],
      ),
    );
    if (!imgRows[0]) return null;
    return {
      data: imgRows[0].image_data,
      mimeType: imgRows[0].mime_type,
    };
  });

// ---------- auth ----------
export const getMe = createServerFn({ method: "GET" }).handler(() => currentUser());

export const login = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({ email: z.string().trim().email().max(255), password: z.string().min(1).max(200) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const ip = getClientIp();
    if (checkIpRateLimit(ip)) return { error: "Invalid email or password." };

    // Try the full query first (new schema), fall back to basic columns (old schema)
    type LoginRow = {
      user_id: number;
      password_hash: string;
      is_active: number;
      failed_attempts: number;
      locked_until: string | null;
    };
    let found: LoginRow[];
    try {
      found = await withDb((c) =>
        rows<LoginRow>(
          c,
          "SELECT user_id, password_hash, is_active, failed_attempts, locked_until FROM users WHERE email=?",
          [data.email.toLowerCase()],
        ),
      );
    } catch {
      // Schema not yet migrated — fetch only the base columns
      const base = await withDb((c) =>
        rows<{ user_id: number; password_hash: string }>(
          c,
          "SELECT user_id, password_hash FROM users WHERE email=?",
          [data.email.toLowerCase()],
        ),
      );
      found = base.map((r) => ({
        ...r,
        is_active: 1,
        failed_attempts: 0,
        locked_until: null,
      }));
    }

    const user = found[0];

    if (!user) {
      recordIpAttempt(ip);
      return { error: "Invalid email or password." };
    }

    if (!user.is_active) {
      recordIpAttempt(ip);
      return { error: "Invalid email or password." };
    }

    if (user.locked_until) {
      const lockTime = new Date(user.locked_until).getTime();
      if (lockTime > Date.now()) {
        recordIpAttempt(ip);
        return { error: "Invalid email or password." };
      }
    }

    const ok = await bcrypt.compare(data.password, user.password_hash);
    if (!ok) {
      recordIpAttempt(ip);
      const newAttempts = user.failed_attempts + 1;
      try {
        if (newAttempts >= 5) {
          await withDb((c) =>
            c.execute(
              "UPDATE users SET failed_attempts=?, locked_until=DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE user_id=?",
              [newAttempts, user.user_id],
            ),
          );
        } else {
          await withDb((c) =>
            c.execute("UPDATE users SET failed_attempts=? WHERE user_id=?", [
              newAttempts,
              user.user_id,
            ]),
          );
        }
      } catch {
        // failed_attempts column may not exist yet — ignore
      }
      return { error: "Invalid email or password." };
    }

    const userRole = await withDb((c) =>
      rows<{ role: string }>(c, "SELECT role FROM users WHERE user_id=?", [user.user_id]),
    );

    if (!userRole[0] || userRole[0].role === "customer") {
      recordIpAttempt(ip);
      return { error: "Access denied. Please contact an administrator." };
    }

    // Success: reset counters
    resetIpAttempts(ip);
    try {
      await withDb((c) =>
        c.execute("UPDATE users SET failed_attempts=0, locked_until=NULL WHERE user_id=?", [
          user.user_id,
        ]),
      );
    } catch {
      // failed_attempts column may not exist yet — ignore
    }

    const userAgent = getUserAgent();
    startSession(user.user_id);
    await issueTokenPair(user.user_id, userAgent);
    return { user: await loadUser(user.user_id) };
  });

export const changeTemporaryPassword = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        temporaryPassword: z.string().min(1, "Temporary password is required").max(200),
        newPassword: z.string().min(6, "New password must be at least 6 characters").max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    // Use currentUser() directly — this is the ONE endpoint allowed when
    // must_change_password=true. requireUser() would block it.
    const u = await currentUser();
    if (!u) throw Object.assign(new Error("Please sign in first."), { status: 401 });
    const found = await withDb((c) =>
      rows<{ password_hash: string }>(c, "SELECT password_hash FROM users WHERE user_id=?", [
        u.user_id,
      ]),
    );
    if (!found[0] || !(await bcrypt.compare(data.temporaryPassword, found[0].password_hash))) {
      throw new Error("Current temporary password does not match.");
    }
    if (data.temporaryPassword === data.newPassword) {
      throw new Error("New password must be different from your temporary password.");
    }
    const newHash = await bcrypt.hash(data.newPassword, 12);
    await withDb((c) =>
      c.execute("UPDATE users SET password_hash=?, must_change_password=0 WHERE user_id=?", [
        newHash,
        u.user_id,
      ]),
    );
    await logAction(null, "CHANGE_TEMPORARY_PASSWORD", "user", u.user_id, null, {
      must_change_password: false,
    });
    await notify(
      u.user_id,
      "security",
      "Temporary Password Updated",
      "Your temporary password has been successfully updated. Welcome to Polar Fiber!",
      "/admin",
    );
    return { ok: true, user: await loadUser(u.user_id) };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const plainRefresh = getCookie("pf_refresh");
  if (plainRefresh) {
    const hash = createHash("sha256").update(plainRefresh).digest("hex");
    await revokeRefreshToken(hash);
  }
  deleteCookie("pf_access", { path: "/", sameSite: "lax", secure: true });
  deleteCookie("pf_refresh", { path: "/", sameSite: "lax", secure: true });
  endSession();
  return { ok: true };
});

export const refreshTokens = createServerFn({ method: "POST" }).handler(async () => {
  const plainRefresh = getCookie("pf_refresh");
  if (!plainRefresh) return { error: "Session expired." };

  const hash = createHash("sha256").update(plainRefresh).digest("hex");
  const tokenRows = await withDb((c) =>
    rows<{ id: number; user_id: number }>(
      c,
      "SELECT id,user_id FROM refresh_tokens WHERE token_hash=? AND revoked_at IS NULL AND expires_at > NOW()",
      [hash],
    ),
  );
  const tokenRow = tokenRows[0];
  if (!tokenRow) return { error: "Session expired." };

  const userAgent = getUserAgent();
  await rotateRefreshToken(hash, tokenRow.user_id, userAgent);
  return { ok: true };
});

// ---------- orders & quotes ----------
async function loadOrders(where: string, params: unknown[]): Promise<Order[]> {
  return withDb(async (c) => {
    const hasOrder = where.toUpperCase().includes("ORDER BY");
    const sql = `SELECT o.order_id,o.user_id,o.total,o.status,o.address,o.is_paid,o.payment_method,o.internal_notes,DATE(o.created_at) created_at,COALESCE(u.name, o.customer_name, 'Guest Customer') customer
        FROM orders o
        LEFT JOIN users u ON u.user_id=o.user_id
        LEFT JOIN order_access oa ON oa.order_id=o.order_id
        ${where} ${hasOrder ? "" : "ORDER BY o.order_id DESC"}`;
    const os = await rows<Omit<Order, "items"> & { customer: string }>(
      c,
      sql,
      params,
    );
    if (!os.length) return [];
    const items = await rows<{
      order_id: number;
      product_id: number;
      product_name: string;
      quantity: number;
      unit_price: number;
    }>(
      c,
      `SELECT order_id,product_id,product_name,quantity,unit_price FROM order_items WHERE order_id IN (${os.map(() => "?").join(",")})`,
      os.map((o) => o.order_id),
    );
    return os.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.order_id) }));
  });
}

export const uploadProductImage = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        file: z.string().min(1), // base64 encoded image
        folder: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission("products.update");
    try {
      const result = await uploadToCloudinary(data.file, data.folder || "polarfiber/products");
      return { ok: true, ...result };
    } catch (err) {
      console.error("[cloudinary] Upload failed:", err);
      throw new Error("Failed to upload image to Cloudinary");
    }
  });

export const deleteProductImage = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        public_id: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission("products.update");
    try {
      await deleteFromCloudinary(data.public_id);
      return { ok: true };
    } catch (err) {
      console.error("[cloudinary] Delete failed:", err);
      throw new Error("Failed to delete image from Cloudinary");
    }
  });

export const placeOrder = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        address: z.string().trim().min(1).max(200),
        items: z
          .array(
            z.object({ product_id: z.number().int(), quantity: z.number().int().min(1).max(1000) }),
          )
          .min(1)
          .max(50),
        name: z.string().trim().min(1).max(100).optional(),
        email: z.string().email().optional(),
        phone: z.string().trim().min(1).max(30).optional(),
        access_password: z.string().trim().min(6).max(100).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await currentUser();
    const isGuest = !u;

    if (isGuest) {
      if (!data.name || !data.email || !data.phone || !data.access_password) {
        throw new Error("Guest checkout requires name, email, phone, and access password.");
      }
    }

    return withDb(async (c) => {
      const ids = [...new Set(data.items.map((i) => i.product_id))].sort((a, b) => a - b);
      if (!ids.length) throw new Error("Order must contain at least one item.");

      await c.beginTransaction();
      try {
        const ps = await rows<{ product_id: number; name: string; price: number; stock: number }>(
          c,
          `SELECT product_id, name, price, stock FROM products WHERE product_id IN (${ids.map(() => "?").join(",")}) ORDER BY product_id FOR UPDATE`,
          ids,
        );

        const lines = data.items.flatMap((i) => {
          const p = ps.find((x) => x.product_id === i.product_id);
          return p ? [{ ...i, p }] : [];
        });

        if (lines.length !== data.items.length) {
          throw new Error("One or more selected products are no longer available.");
        }

        const total = lines.reduce((t, l) => t + l.p.price * l.quantity, 0);

        const [r] = await c.execute("INSERT INTO orders (user_id,total,address) VALUES (?,?,?)", [
          u?.user_id ?? null,
          total,
          data.address,
        ]);
        const oid = (r as { insertId: number }).insertId;

        // order_number must be backfilled after the insert: MySQL cannot derive it
        // from the AUTO_INCREMENT id at INSERT time, and the column has no default.
        await c.execute("UPDATE orders SET order_number=? WHERE order_id=?", [
          `PF-ORD-${oid}`,
          oid,
        ]);

        if (isGuest) {
          const hashedPass = await bcrypt.hash(data.access_password!, 12);
          await c.execute(
            "INSERT INTO order_access (order_id, access_pass, email) VALUES (?,?,?)",
            [oid, hashedPass, data.email!],
          );
        }

        for (const l of lines) {
          await c.execute(
            "INSERT INTO order_items (order_id,product_id,product_name,quantity,unit_price) VALUES (?,?,?,?,?)",
            [oid, l.product_id, l.p.name, l.quantity, l.p.price],
          );

          await changeStock(
            c,
            l.product_id,
            -l.quantity,
            `Order #${oid} placed`,
            "order",
            oid,
            u?.user_id ?? null,
          );
        }

        await c.commit();

        if (isGuest) {
          startOrderSession(oid);
          const { sendOrderConfirmation } = await import("./email");
          try {
            await sendOrderConfirmation(data.email!, data.name!, oid, total);
          } catch {
            // Email failure is non-fatal: order is saved, failure recorded for retry.
          }
        }

        return { order_id: oid, order_number: `PF-ORD-${oid}` };
      } catch (e) {
        await c.rollback().catch(() => {});
        throw e;
      }
    });
  });

export const getOrderStatusPublic = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        order_id: z.number().int().min(1),
        access_password: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    return withDb(async (c) => {
      const [oa] = await rows<{ order_id: number; access_pass: string }>(
        c,
        "SELECT order_id, access_pass FROM order_access WHERE order_id = ?",
        [data.order_id],
      );

      if (!oa) throw new Error("Order not found.");

      const valid = await bcrypt.compare(data.access_password, oa.access_pass);
      if (!valid) throw new Error("Invalid access password.");

      const [o] = await rows<Omit<Order, "items"> & { status: OrderStatus }>(
        c,
        // Explicit columns only: internal_notes must never reach a guest, and
        // order_status_history (not order_status_log) is the real table.
        `SELECT o.order_id, o.user_id, o.total, o.status, o.address, o.is_paid,
                o.payment_method, DATE(o.created_at) created_at,
                o.customer_name, o.customer_phone
         FROM orders o WHERE o.order_id = ?`,
        [data.order_id],
      );

      if (!o) throw new Error("Order not found.");

      const items = await rows<{
        product_id: number;
        product_name: string;
        quantity: number;
        unit_price: number;
      }>(
        c,
        "SELECT product_id, product_name, quantity, unit_price FROM order_items WHERE order_id = ?",
        [data.order_id],
      );

      return { order: { ...o, items } };
    });
  });

// ─── order communication (customer ↔ staff) ──────────────────────────────────

const MESSAGE_SELECT = `SELECT m.id, m.sender_type, m.sender_user_id, m.sender_name, m.kind,
      m.body, m.status_from, m.status_to,
      DATE_FORMAT(m.created_at, '%Y-%m-%d %H:%i') created_at
   FROM order_messages m`;

interface OrderContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string;
  user_id: number | null;
}

async function loadOrderContact(
  c: mysql.Connection,
  orderId: number,
): Promise<OrderContact | null> {
  const [o] = await rows<{
    user_id: number | null;
    customer_name: string | null;
    customer_phone: string | null;
    address: string;
  }>(c, "SELECT user_id, customer_name, customer_phone, address FROM orders WHERE order_id = ?", [
    orderId,
  ]);
  if (!o) return null;

  let name = o.customer_name ?? null;
  let email: string | null = null;
  let phone = o.customer_phone ?? null;

  if (o.user_id) {
    const [u] = await rows<{ name: string; email: string; phone: string }>(
      c,
      "SELECT name, email, phone FROM users WHERE user_id = ?",
      [o.user_id],
    );
    if (u) {
      name = u.name;
      email = u.email;
      phone = u.phone || phone;
    }
  } else {
    const [oa] = await rows<{ email: string }>(
      c,
      "SELECT email FROM order_access WHERE order_id = ?",
      [orderId],
    );
    email = oa?.email ?? null;
  }

  return { name, email, phone, address: o.address, user_id: o.user_id };
}

/**
 * Writes a customer-visible entry into the order thread. Never accepts staff
 * internal notes — only explicitly customer-facing text.
 */
async function pushCustomerOrderUpdate(
  c: mysql.Connection,
  orderId: number,
  kind: "message" | "status" | "delivery",
  body: string | null,
  statusFrom: string | null = null,
  statusTo: string | null = null,
): Promise<number> {
  const [r] = await c.execute(
    `INSERT INTO order_messages (order_id, sender_type, sender_name, kind, body, status_from, status_to, is_read_by_customer, is_read_by_staff)
     VALUES (?, 'system', 'system', ?, ?, ?, ?, 0, 1)`,
    [orderId, kind, body, statusFrom, statusTo],
  );
  return (r as { insertId: number }).insertId;
}

/**
 * Emails the customer about an order event. Works for guests because it uses
 * the order's own contact email rather than a user id.
 */
async function emailOrderCustomer(orderId: number, newStatus: string): Promise<void> {
  try {
    const contact = await withDb((c) => loadOrderContact(c, orderId));
    if (!contact?.email) return;
    const { sendOrderStatusEmail } = await import("./email");
    await sendOrderStatusEmail(contact.email, contact.name ?? "Customer", orderId, newStatus, 0);
  } catch (err) {
    console.error("[emailOrderCustomer] Failed:", err);
  }
}

async function requireOrderSession(): Promise<number> {
  const oid = orderSessionOrderId();
  if (!oid) {
    throw Object.assign(new Error("Please verify your order first."), { status: 401 });
  }
  return oid;
}

/** Throws 403 unless the caller's order-scoped session is for this order. */
function assertOrderOwnership(sessionOrderId: number, orderId: number): void {
  if (sessionOrderId !== orderId) {
    throw Object.assign(new Error("You can only access the order you verified."), {
      status: 403,
    });
  }
}

export const verifyOrderAccess = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        order_number: z.union([z.string().min(1).max(30), z.number().int().min(1)]),
        email: z.string().trim().email().max(255),
        access_password: z.string().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const ip = getClientIp();
    const parsedId = parseOrderId(data.order_number);
    const attemptKey = `order-verify:${ip}:${parsedId ?? "unknown"}`;

    const rl = rateLimit(attemptKey, 5, 15 * 60 * 1000);
    if (!rl.ok) {
      throw Object.assign(new Error("Too many attempts. Please wait 15 minutes and try again."), {
        status: 429,
      });
    }

    const result = await withDb(async (c) => {
      // Accepts "1009" or "PF-ORD-1009"
      const [order] = parsedId
        ? await rows<{ order_id: number }>(c, "SELECT order_id FROM orders WHERE order_id = ?", [
            parsedId,
          ])
        : [];

      const [oa] = order
        ? await rows<{ access_pass: string; email: string }>(
            c,
            "SELECT access_pass, email FROM order_access WHERE order_id = ?",
            [order.order_id],
          )
        : [];

      // One identical error for every failure mode: never reveal whether the
      // order number, the email or the password was the wrong part.
      if (!order || !oa || !isEmailMatch(oa.email, data.email)) {
        return { failed: true as const };
      }

      const valid = await bcrypt.compare(data.access_password, oa.access_pass);
      if (!valid) return { failed: true as const };

      startOrderSession(order.order_id);
      resetRateLimit(attemptKey);
      await logAction(null, "VERIFY_ORDER_ACCESS", "order", order.order_id, null, null);
      return { failed: false as const, order_id: order.order_id };
    });

    if (result.failed) {
      throw new Error("Order not found. Check your order number, email and password.");
    }
    return { ok: true, order_id: result.order_id };
  });

export const endOrderAccess = createServerFn({ method: "POST" }).handler(() => {
  endOrderSession();
  return { ok: true };
});

/** Verify email + order-access password across all orders for that email. Returns matching orders only. */
export const verifyOrderAccessByEmail = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        access_password: z.string().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const ip = getClientIp();
    const attemptKey = `order-verify-email:${ip}:${data.email.toLowerCase()}`;

    const rl = rateLimit(attemptKey, 5, 15 * 60 * 1000);
    if (!rl.ok) {
      throw Object.assign(new Error("Too many attempts. Please wait 15 minutes and try again."), {
        status: 429,
      });
    }

    const result = await withDb(async (c) => {
      const accessRecords = await rows<{
        order_id: number;
        access_pass: string;
        email: string;
      }>(c, "SELECT order_id, access_pass, email FROM order_access WHERE email = ?", [
        data.email.toLowerCase(),
      ]);

      const matchedOrderIds: number[] = [];
      for (const record of accessRecords) {
        const valid = await bcrypt.compare(data.access_password, record.access_pass);
        if (valid) {
          matchedOrderIds.push(record.order_id);
        }
      }

      if (matchedOrderIds.length === 0) {
        return { failed: true as const };
      }

      const orders = await rows<{
        order_id: number;
        order_number: string | null;
        status: OrderStatus;
        total: number;
        address: string;
        is_paid: number;
        payment_method: string;
        created_at: string;
      }>(
        c,
        `SELECT o.order_id, o.order_number, o.status, o.total, o.address, o.is_paid,
                o.payment_method, DATE(o.created_at) created_at
         FROM orders o WHERE o.order_id IN (${matchedOrderIds.map(() => "?").join(",")})
         ORDER BY o.order_id DESC`,
        matchedOrderIds,
      );

      const itemsMap: Record<
        number,
        Array<{ product_id: number; product_name: string; quantity: number; unit_price: number }>
      > = {};
      if (orders.length) {
        const items = await rows<{
          order_id: number;
          product_id: number;
          product_name: string;
          quantity: number;
          unit_price: number;
        }>(
          c,
          `SELECT order_id, product_id, product_name, quantity, unit_price
           FROM order_items WHERE order_id IN (${orders.map(() => "?").join(",")})`,
          orders.map((o) => o.order_id),
        );
        for (const item of items) {
          const arr = itemsMap[item.order_id] ?? [];
          arr.push(item);
          itemsMap[item.order_id] = arr;
        }
      }

      resetRateLimit(attemptKey);
      await logAction(null, "VERIFY_ORDER_ACCESS_BY_EMAIL", "order", "multiple", null, {
        matched_count: matchedOrderIds.length,
      });
      return {
        failed: false as const,
        orders: orders.map((o) => ({ ...o, items: itemsMap[o.order_id] ?? [] })),
      };
    });

    if (result.failed) {
      throw new Error("Invalid email or order-access password.");
    }
    return { ok: true, orders: result.orders };
  });

/** Start an order-scoped session for a specific verified order so the customer can view it. */
export const startOrderAccessSession = createServerFn({ method: "POST" })
  .validator((d) => z.object({ order_id: z.number().int().min(1) }).parse(d))
  .handler(async ({ data }) => {
    startOrderSession(data.order_id);
    return { ok: true };
  });

/** Staff/admin view of a conversation thread for one order. */
export const getOrderMessages = createServerFn({ method: "POST" })
  .validator((d) => z.object({ order_id: z.number().int().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission("orders.view");
    return withDb(async (c) => {
      const contact = await loadOrderContact(c, data.order_id);
      if (!contact) throw new Error("Order not found.");

      const messages = await rows<{
        id: number;
        sender_type: string;
        sender_user_id: number | null;
        sender_name: string;
        kind: string;
        body: string | null;
        status_from: string | null;
        status_to: string | null;
        created_at: string;
      }>(c, `${MESSAGE_SELECT} WHERE m.order_id = ? ORDER BY m.id ASC`, [data.order_id]);

      await c.execute(
        "UPDATE order_messages SET is_read_by_staff = 1 WHERE order_id = ? AND sender_type = 'customer'",
        [data.order_id],
      );

      return { order_id: data.order_id, messages, customer: contact };
    });
  });

/** Staff/admin reply that appears on the customer's tracking page. */
export const sendOrderMessage = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        order_id: z.number().int().min(1),
        message: z.unknown(),
        client_message_id: z.string().trim().min(1).max(64).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requirePermission("orders.update_status");

    const body = sanitizeMessage(data.message);
    if (!isMessageLengthValid(body)) {
      throw new Error("Message must be between 1 and 2000 characters.");
    }

    const rl = rateLimit(`order-msg-staff:${u.user_id}:${data.order_id}`, 20, 5 * 60 * 1000);
    if (!rl.ok) {
      throw Object.assign(new Error("Too many messages. Please wait a minute."), { status: 429 });
    }

    return withDb(async (c) => {
      if (data.client_message_id) {
        const [existing] = await rows<{ id: number }>(
          c,
          "SELECT id FROM order_messages WHERE client_message_id = ?",
          [data.client_message_id],
        );
        if (existing) return { id: existing.id, duplicate: true };
      }

      const contact = await loadOrderContact(c, data.order_id);
      if (!contact) throw new Error("Order not found.");

      const [r] = await c.execute(
        `INSERT INTO order_messages
           (order_id, sender_type, sender_user_id, sender_name, kind, body, client_message_id, is_read_by_customer)
         VALUES (?, ?, ?, ?, 'message', ?, ?, 0)`,
        [data.order_id, u.role, u.user_id, u.name, body, data.client_message_id ?? null],
      );
      const id = (r as { insertId: number }).insertId;

      // Guests have no notifications row (notifications.user_id is NOT NULL),
      // so the customer is reached by email; registered buyers also get the
      // in-app notification. Email failure never fails the reply.
      if (contact.email) {
        const { sendMessageNotificationEmail } = await import("./email");
        await sendMessageNotificationEmail(
          contact.email,
          contact.name ?? "Customer",
          `Order #${data.order_id} - new message from Polar Fiber`,
          preview(body),
          "https://polarfiber.com.et/track-order",
          { conversationType: "order", conversationId: data.order_id },
        );
      }

      if (contact.user_id) {
        await notify(
          contact.user_id,
          "customer_message",
          `New message on Order #${data.order_id}`,
          body,
          "/track-order",
          { dedupeKey: `order-message:${id}` },
        );
      }

      await logAction(null, "STAFF_ORDER_MESSAGE", "order", data.order_id, null, {
        message_id: id,
      });
      return { id, duplicate: false };
    });
  });

/** Guest thread, readable only with this order's verified session. */
export const getGuestOrderThread = createServerFn({ method: "POST" })
  .validator((d) => z.object({ order_id: z.number().int().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const sessionOrderId = await requireOrderSession();
    assertOrderOwnership(sessionOrderId, data.order_id);

    return withDb(async (c) => {
      const messages = await rows<{
        id: number;
        sender_type: string;
        sender_name: string;
        kind: string;
        body: string | null;
        status_from: string | null;
        status_to: string | null;
        created_at: string;
      }>(c, `${MESSAGE_SELECT} WHERE m.order_id = ? ORDER BY m.id ASC`, [data.order_id]);

      await c.execute(
        "UPDATE order_messages SET is_read_by_customer = 1 WHERE order_id = ? AND sender_type <> 'customer'",
        [data.order_id],
      );

      const [oauth] = await rows<{ email: string }>(
        c,
        "SELECT email FROM order_access WHERE order_id = ?",
        [data.order_id],
      );

      return { order_id: data.order_id, messages, email: oauth?.email ?? null };
    });
  });

/** Guest reply from the tracking page, no account required. */
export const sendGuestOrderMessage = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        order_id: z.number().int().min(1),
        message: z.unknown(),
        client_message_id: z.string().trim().min(1).max(64).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sessionOrderId = await requireOrderSession();
    assertOrderOwnership(sessionOrderId, data.order_id);

    const body = sanitizeMessage(data.message);
    if (!isMessageLengthValid(body)) {
      throw new Error("Message must be between 1 and 2000 characters.");
    }

    const rl = rateLimit(`order-msg-guest:${data.order_id}`, 10, 10 * 60 * 1000);
    if (!rl.ok) {
      throw Object.assign(
        new Error("You're sending messages too quickly. Please try again in a few minutes."),
        { status: 429 },
      );
    }

    return withDb(async (c) => {
      if (data.client_message_id) {
        const [existing] = await rows<{ id: number }>(
          c,
          "SELECT id FROM order_messages WHERE client_message_id = ?",
          [data.client_message_id],
        );
        if (existing) return { id: existing.id, duplicate: true };
      }

      const contact = await loadOrderContact(c, data.order_id);
      if (!contact) throw new Error("Order not found.");

      const [r] = await c.execute(
        `INSERT INTO order_messages
           (order_id, sender_type, sender_user_id, sender_name, kind, body, client_message_id, is_read_by_staff)
         VALUES (?, 'customer', NULL, ?, 'message', ?, ?, 0)`,
        [data.order_id, contact.name ?? "Customer", body, data.client_message_id ?? null],
      );
      const id = (r as { insertId: number }).insertId;

      const recipients = await rows<{ user_id: number }>(
        c,
        "SELECT user_id FROM users WHERE role IN ('admin','staff') AND COALESCE(is_active,1)=1",
      );
      for (const rec of recipients) {
        // Per-recipient key: a shared key would let the first recipient
        // suppress everyone else's notification.
        await notify(
          rec.user_id,
          "customer_message",
          `New message on Order #${data.order_id}`,
          `${contact.name ?? "A customer"}: ${preview(body, 200)}`,
          "/admin",
          { dedupeKey: `order-message:${id}:${rec.user_id}` },
        );
      }

      await logAction(null, "CUSTOMER_ORDER_MESSAGE", "order", data.order_id, null, {
        message_id: id,
      });
      return { id, duplicate: false };
    });
  });

/** Internal helper – creates (or reuses) a conversation token for a quote or contact message. */
async function createConversationToken(
  conversationType: ConversationType,
  conversationId: number,
  email: string,
): Promise<string> {
  const token = generateConversationToken();
  const expiresAt = conversationTokenExpiry();
  await withDb((c) =>
    c.execute(
      `INSERT INTO conversation_tokens (token, conversation_type, conversation_id, email, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        token,
        conversationType,
        conversationId,
        email,
        expiresAt.toISOString().slice(0, 19).replace("T", " "),
      ],
    ),
  );
  return token;
}

/** Internal helper – looks up a valid (non-expired) token and its conversation. */
interface ConversationTokenRecord {
  token: string;
  conversation_type: ConversationType;
  conversation_id: number;
  email: string;
  expires_at: string;
  created_at: string;
}

/** Messages returned to customers via conversation tokens. */
interface ConversationMessage {
  id: number;
  sender_type: string;
  sender_name: string;
  reply_text: string;
  is_internal: number;
  created_at: string;
  staff_id?: number | null;
  staff_name?: string | null;
  read?: number;
}

/** Public endpoint – retrieve a conversation by token (no auth required). */
export const getConversation = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const tokenRow = await withDb((c) =>
      rows<ConversationTokenRecord>(
        c,
        `SELECT token, conversation_type, conversation_id, email, expires_at, created_at
         FROM conversation_tokens WHERE token = ?`,
        [data.token],
      ),
    );

    if (!tokenRow || tokenRow.length === 0) {
      throw Object.assign(new Error("Invalid or expired conversation link."), { status: 404 });
    }

    const record = tokenRow[0]!;
    if (new Date(record.expires_at).getTime() < Date.now()) {
      throw Object.assign(new Error("This conversation link has expired."), { status: 410 });
    }

    // Fetch messages based on conversation type
    if (record.conversation_type === "quote") {
      const messages = await withDb((c) =>
        rows<ConversationMessage>(
          c,
          `SELECT id, sender_type, sender_name, reply_text, is_internal, created_at
           FROM quote_replies WHERE quote_id = ?
           ORDER BY created_at ASC`,
          [record.conversation_id],
        ),
      );
      return {
        conversation_type: "quote" as const,
        conversation_id: record.conversation_id,
        email: record.email,
        expires_at: record.expires_at,
        messages: messages.filter((m) => !m.is_internal),
      };
    } else {
      // contact_message
      const messages = await withDb((c) =>
        rows<ConversationMessage>(
          c,
          `SELECT m.id, m.staff_id, m.staff_name, m.reply_text, m.is_internal, m.created_at, m.read
           FROM contact_message_replies m
           WHERE m.message_id = ?
           ORDER BY m.created_at ASC`,
          [record.conversation_id],
        ),
      );
      return {
        conversation_type: "contact_message" as const,
        conversation_id: record.conversation_id,
        email: record.email,
        expires_at: record.expires_at,
        messages: messages.filter((m) => !m.is_internal),
      };
    }
  });

/** Public endpoint – submit a customer reply using a conversation token. */
export const replyConversation = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        token: z.string().min(1).max(64),
        message: z.string().trim().min(1).max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const tokenRow = await withDb((c) =>
      rows<ConversationTokenRecord>(
        c,
        `SELECT token, conversation_type, conversation_id, email, expires_at
         FROM conversation_tokens WHERE token = ?`,
        [data.token],
      ),
    );

    if (!tokenRow || tokenRow.length === 0) {
      throw Object.assign(new Error("Invalid or expired conversation link."), { status: 404 });
    }

    const record = tokenRow[0]!;
    if (new Date(record.expires_at).getTime() < Date.now()) {
      throw Object.assign(new Error("This conversation link has expired."), { status: 410 });
    }

    // Get sanitized message content
    const cleanText = sanitizeMessage(data.message);

    if (record.conversation_type === "quote") {
      // Insert customer reply into quote_replies
      const result = await withDb((c) =>
        c.execute(
          `INSERT INTO quote_replies (quote_id, sender_type, sender_name, reply_text, is_internal)
           VALUES (?, 'customer', ?, ?, 0)`,
          [record.conversation_id, record.email, cleanText],
        ),
      );

      const [r] = result;
      const replyId = (r as { insertId: number }).insertId;

      // Record the audit trail
      await logAction(null, "QUOTE_CUSTOMER_REPLY", "quote_reply", replyId, null, {
        quote_id: record.conversation_id,
        from_email: record.email,
        message_preview: data.message.slice(0, 100),
      });

      return { reply_id: replyId, conversation_type: "quote" };
    } else {
      // contact_message
      const result = await withDb((c) =>
        c.execute(
          `INSERT INTO contact_message_replies (message_id, staff_id, staff_name, reply_text, is_internal)
           VALUES (?, NULL, ?, ?, 0)`,
          [record.conversation_id, record.email, cleanText],
        ),
      );

      const [r] = result;
      const replyId = (r as { insertId: number }).insertId;

      // Record the audit trail
      await logAction(null, "CONTACT_CUSTOMER_REPLY", "contact_message_reply", replyId, null, {
        message_id: record.conversation_id,
        from_email: record.email,
        message_preview: data.message.slice(0, 100),
      });

      return { reply_id: replyId, conversation_type: "contact_message" };
    }
  });

/** Staff endpoint – view all replies for a quote (includes internal notes). */
export const getQuoteReplies = createServerFn({ method: "POST" })
  .validator((d) => z.object({ quote_id: z.number().int().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission("quotes.view");
    return withDb((c) =>
      c.execute(
        `SELECT id, sender_type, sender_name, reply_text, is_internal, created_at
         FROM quote_replies WHERE quote_id = ?
         ORDER BY created_at ASC`,
        [data.quote_id],
      ),
    );
  });

/** Staff endpoint – view line items for a quote. */
export const getQuoteItems = createServerFn({ method: "POST" })
  .validator((d) => z.object({ quote_id: z.number().int().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission("quotes.view");
    return withDb((c) =>
      rows<{
        id: number;
        quote_id: number;
        product_id: number | null;
        product_name: string;
        quantity: number;
        unit_price: number;
      }>(
        c,
        `SELECT id, quote_id, product_id, product_name, quantity, unit_price
         FROM quote_items WHERE quote_id = ?
         ORDER BY id ASC`,
        [data.quote_id],
      ),
    );
  });

/** Staff endpoint – save/replace line items for a quote. */
export const saveQuoteItems = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        quote_id: z.number().int().min(1),
        items: z
          .array(
            z.object({
              product_id: z.number().int().nullable().optional(),
              product_name: z.string().trim().min(1).max(150),
              quantity: z.number().int().min(1).max(10000),
              unit_price: z.number().min(0).max(1e9),
            }),
          )
          .min(1)
          .max(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requirePermission("quotes.respond");
    return withDb(async (c) => {
      const [q] = await rows<{ quote_id: number }>(c, "SELECT quote_id FROM quote_requests WHERE quote_id=?", [
        data.quote_id,
      ]);
      if (!q) throw new Error("Quote not found.");

      await c.beginTransaction();
      try {
        await c.execute("DELETE FROM quote_items WHERE quote_id=?", [data.quote_id]);
        for (const item of data.items) {
          await c.execute(
            `INSERT INTO quote_items (quote_id, product_id, product_name, quantity, unit_price)
             VALUES (?, ?, ?, ?, ?)`,
            [data.quote_id, item.product_id ?? null, item.product_name, item.quantity, item.unit_price],
          );
        }
        await c.commit();
      } catch (e) {
        await c.rollback().catch(() => {});
        throw e;
      }
      return { ok: true, count: data.items.length };
    });
  });

/** Staff endpoint – view all replies for a contact message (includes internal notes). */
export const getContactMessageReplies = createServerFn({ method: "POST" })
  .validator((d) => z.object({ message_id: z.number().int().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission("messages.view");
    return withDb((c) =>
      rows<{
        id: number;
        staff_id: number;
        staff_name: string;
        reply_text: string;
        is_internal: number;
        created_at: string;
        read: number;
      }>(
        c,
        `SELECT id, staff_id, staff_name, reply_text, is_internal, created_at, read
         FROM contact_message_replies WHERE message_id = ?
         ORDER BY id ASC`,
        [data.message_id],
      ),
    );
  });

/** Staff endpoint – list email failures for retry. */
export const getFailedEmails = createServerFn({ method: "POST" })
  .validator((d) => z.object({ limit: z.number().int().min(1).max(200).optional() }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission("messages.view");
    const limit = data.limit ?? 50;
    return withDb((c) =>
      c.execute(
        `SELECT id, recipient, subject, conversation_type, conversation_id, error, retry_count, next_retry_at, created_at
         FROM email_failures
         WHERE retry_count < 3
         ORDER BY created_at DESC
         LIMIT ?`,
        [limit],
      ),
    );
  });

/** Staff endpoint – retry a previously failed email delivery. */
export const retryEmailDelivery = createServerFn({ method: "POST" })
  .validator((d) => z.object({ id: z.number().int().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission("messages.reply");
    const { retryEmail } = await import("./email");
    const ok = await retryEmail(data.id);
    return { ok };
  });

/** Internal staff notes — never returned by any guest/public endpoint. */
export const getOrderInternalNotes = createServerFn({ method: "POST" })
  .validator((d) => z.object({ order_id: z.number().int().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission("orders.view");
    return withDb((c) =>
      rows<{
        id: number;
        staff_id: number | null;
        staff_name: string;
        note: string;
        created_at: string;
      }>(
        c,
        `SELECT n.id, n.staff_id, n.staff_name, n.note,
                DATE_FORMAT(n.created_at, '%Y-%m-%d %H:%i') created_at
         FROM order_internal_notes n WHERE n.order_id = ? ORDER BY n.id DESC`,
        [data.order_id],
      ),
    );
  });

export const addOrderInternalNote = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        order_id: z.number().int().min(1),
        note: z.unknown(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requirePermission("orders.add_note");

    const note = sanitizeMessage(data.note);
    if (!isMessageLengthValid(note)) {
      throw new Error("Note must be between 1 and 2000 characters.");
    }

    const rl = rateLimit(`order-note:${u.user_id}:${data.order_id}`, 20, 5 * 60 * 1000);
    if (!rl.ok) {
      throw Object.assign(new Error("Too many notes. Please wait a minute."), { status: 429 });
    }

    const id = await withDb(async (c) => {
      const [r] = await c.execute(
        "INSERT INTO order_internal_notes (order_id, staff_id, staff_name, note) VALUES (?, ?, ?, ?)",
        [data.order_id, u.user_id, u.name, note],
      );

      // Keep the legacy orders.internal_notes blob in sync so older UI and
      // any external readers still see the note.
      const [row] = await rows<{ internal_notes: string | null }>(
        c,
        "SELECT internal_notes FROM orders WHERE order_id = ?",
        [data.order_id],
      );
      const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
      const entry = `[${stamp} - ${u.name}]: ${note}`;
      const merged = row?.internal_notes ? `${row.internal_notes}\n${entry}` : entry;
      await c.execute("UPDATE orders SET internal_notes = ? WHERE order_id = ?", [
        merged,
        data.order_id,
      ]);

      return (r as { insertId: number }).insertId;
    });

    await logAction(null, "ADD_ORDER_INTERNAL_NOTE", "order", data.order_id, null, {
      note_id: id,
    });
    return { ok: true, id };
  });

export const submitQuote = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        name: z.string().trim().min(1).max(100),
        email: z.string().trim().email().max(255),
        subject: z.string().trim().min(1).max(150),
        message: z.string().trim().min(1).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await currentUser();
    await withDb(async (c) => {
      const [r] = await c.execute(
        "INSERT INTO quote_requests (user_id,name,email,subject,message) VALUES (?,?,?,?,?)",
        [u?.user_id ?? null, data.name, data.email, data.subject, data.message],
      );
      const quoteId = (r as { insertId: number }).insertId;

      // quote_number must be backfilled after the insert: MySQL cannot derive it
      // from the AUTO_INCREMENT id at INSERT time, and the column has no default.
      await c.execute("UPDATE quote_requests SET quote_number=? WHERE quote_id=?", [
        `PF-QT-${quoteId}`,
        quoteId,
      ]);
    });
    return { ok: true };
  });

const QUOTE_SQL =
  "SELECT quote_id,user_id,name,email,phone,subject,message,delivery_location,quoted_amount,valid_until,assigned_to,status,DATE(created_at) created_at FROM quote_requests";

// ---------- admin & staff ----------
export const getAdminData = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("dashboard.view");
  const orders = await loadOrders("", []);
  return withDb(async (c) => ({
    orders,
    quotes: await rows<Quote>(c, `${QUOTE_SQL} ORDER BY quote_id DESC`),
    products: await rows<Product>(c, `${PRODUCT_SQL} ORDER BY p.product_id`),
    users: await rows<{
      user_id: number;
      name: string;
      email: string;
      phone: string;
      role: string;
      orders: number;
    }>(
      c,
      `SELECT u.user_id,u.name,u.email,u.phone,
        CASE
          WHEN EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.user_id AND r.role='admin') THEN 'admin'
          WHEN EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.user_id AND r.role='staff') THEN 'staff'
          ELSE 'customer'
        END role,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id=u.user_id) orders
       FROM users u ORDER BY u.user_id`,
    ),
  }));
});

export const getAdminOverview = createServerFn({ method: "GET" }).handler(async () => {
  const u = await requirePermission("dashboard.view");
  const isStaff = u.role === "staff";
  return withDb(async (c) => {
    // 1. KPI stats
    const rev = isStaff
      ? { revenue: 0 }
      : (
          await rows<{ revenue: number }>(
            c,
            "SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE status = 'Delivered'",
          )
        )[0];
    const [ordCount] = await rows<{ count: number }>(c, "SELECT COUNT(*) as count FROM orders");
    const [pendingOrdersKpi] = await rows<{ count: number }>(
      c,
      "SELECT COUNT(*) as count FROM orders WHERE status = 'Pending'",
    );
    const [completedOrders] = await rows<{ count: number }>(
      c,
      "SELECT COUNT(*) as count FROM orders WHERE status = 'Delivered'",
    );
    const [quoteCount] = await rows<{ count: number }>(
      c,
      "SELECT COUNT(*) as count FROM quote_requests WHERE status = 'New'",
    );
    const [lowStock] = await rows<{ count: number }>(
      c,
      "SELECT COUNT(*) as count FROM products WHERE stock <= 5",
    );
    const [unreadMessages] = await rows<{ count: number }>(
      c,
      "SELECT COUNT(*) as count FROM contact_messages WHERE is_read = 0",
    );
    // Distinct customers across orders, quotes, and contact messages.
    // Registered users are counted by user_id; guests by email.
    const [customerCount] = await rows<{ count: number }>(
      c,
      `SELECT COUNT(DISTINCT identifier) as count FROM (
        SELECT CONVERT(user_id, CHAR) COLLATE utf8mb4_unicode_ci as identifier FROM orders WHERE user_id IS NOT NULL
        UNION
        SELECT CONVERT(user_id, CHAR) COLLATE utf8mb4_unicode_ci as identifier FROM quote_requests WHERE user_id IS NOT NULL
        UNION
        SELECT CONVERT(oa.email, CHAR) COLLATE utf8mb4_unicode_ci as identifier FROM orders o
          JOIN order_access oa ON oa.order_id = o.order_id
          WHERE o.user_id IS NULL AND oa.email IS NOT NULL AND oa.email != ''
        UNION
        SELECT CONVERT(email, CHAR) COLLATE utf8mb4_unicode_ci as identifier FROM quote_requests
          WHERE user_id IS NULL AND email IS NOT NULL AND email != ''
        UNION
        SELECT CONVERT(email, CHAR) COLLATE utf8mb4_unicode_ci as identifier FROM contact_messages
          WHERE email IS NOT NULL AND email != ''
      ) as t`,
    );

    // 2. Timeline (Last 30 days daily orders & revenue)
    const timeline = isStaff
      ? (
          await rows<{ date: string; count: number }>(
            c,
            `SELECT DATE(created_at) as date,
                    COUNT(*) as count
             FROM orders
             WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
             GROUP BY DATE(created_at)
             ORDER BY DATE(created_at) ASC`,
          )
        ).map((r) => ({ ...r, total: 0 }))
      : await rows<{ date: string; count: number; total: number }>(
          c,
          `SELECT DATE(created_at) as date,
                  COUNT(*) as count,
                  COALESCE(SUM(CASE WHEN status = 'Delivered' THEN total ELSE 0 END), 0) as total
           FROM orders
           WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
           GROUP BY DATE(created_at)
           ORDER BY DATE(created_at) ASC`,
        );

    // 3. Category Revenue breakdown (scrubbed for staff)
    const categoryRevenue = isStaff
      ? (
          await rows<{ category: string; count: number }>(
            c,
            `SELECT c.name as category,
                    COALESCE(SUM(oi.quantity), 0) as count
             FROM categories c
             LEFT JOIN products p ON p.category_id = c.category_id
             LEFT JOIN order_items oi ON oi.product_id = p.product_id
             LEFT JOIN orders o ON o.order_id = oi.order_id AND o.status != 'Cancelled'
             GROUP BY c.category_id, c.name`,
          )
        ).map((r) => ({ ...r, revenue: 0 }))
      : await rows<{ category: string; revenue: number; count: number }>(
          c,
          `SELECT c.name as category,
                  COALESCE(SUM(oi.quantity * oi.unit_price), 0) as revenue,
                  COALESCE(SUM(oi.quantity), 0) as count
           FROM categories c
           LEFT JOIN products p ON p.category_id = c.category_id
           LEFT JOIN order_items oi ON oi.product_id = p.product_id
           LEFT JOIN orders o ON o.order_id = oi.order_id AND o.status != 'Cancelled'
           GROUP BY c.category_id, c.name
           ORDER BY revenue DESC`,
        );

    // 4. Status distribution
    const statusCounts = await rows<{ status: OrderStatus; count: number }>(
      c,
      "SELECT status, COUNT(*) as count FROM orders GROUP BY status",
    );
    const totalOrderCount = Number(ordCount?.count ?? 0);
    const statusDistribution = statusCounts.map((sc) => ({
      status: sc.status,
      count: Number(sc.count),
      percentage: totalOrderCount > 0 ? Math.round((Number(sc.count) / totalOrderCount) * 100) : 0,
    }));

    // 5. Attention panel items
    const rawPendingOrders = await loadOrders("WHERE o.status='Pending' LIMIT 10", []);
    const pendingOrders = isStaff
      ? rawPendingOrders.map((o) => ({
          ...o,
          total: 0,
          items: o.items.map((it) => ({ ...it, unit_price: 0 })),
        }))
      : rawPendingOrders;

    const newQuotes = await rows<Quote>(
      c,
      `${QUOTE_SQL} WHERE status='New' ORDER BY quote_id DESC LIMIT 10`,
    );
    const lowStockProducts = await rows<Product>(
      c,
      `${PRODUCT_SQL} AND p.stock <= 5 ORDER BY p.stock ASC LIMIT 10`,
    );

    return {
      kpis: {
        totalRevenue: isStaff ? 0 : Number(rev?.revenue ?? 0),
        totalOrders: Number(ordCount?.count ?? 0),
        pendingOrders: Number(pendingOrdersKpi?.count ?? 0),
        completedOrders: Number(completedOrders?.count ?? 0),
        newQuotes: Number(quoteCount?.count ?? 0),
        lowStockCount: Number(lowStock?.count ?? 0),
        customers: Number(customerCount?.count ?? 0),
        unreadMessages: Number(unreadMessages?.count ?? 0),
      },
      timeline,
      categoryRevenue,
      statusDistribution,
      attention: {
        pendingOrders,
        newQuotes,
        lowStockProducts,
      },
    };
  });
});

export const getOrdersPage = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(10),
        search: z.string().trim().max(100).optional(),
        status: z.string().trim().max(50).optional(),
        startDate: z.string().trim().max(50).optional(),
        endDate: z.string().trim().max(50).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const actor = await requirePermission("orders.view");
    const isStaff = actor.role === "staff";
    const page = data.page ?? 1;
    const pageSize = data.pageSize ?? 10;
    const offset = (page - 1) * pageSize;

    return withDb(async (c) => {
      const whereClauses: string[] = [];
      const queryParams: unknown[] = [];

      if (data.search && data.search.trim()) {
        const term = `%${data.search.trim()}%`;
        whereClauses.push("(CAST(o.order_id AS CHAR) LIKE ? OR u.name LIKE ? OR o.address LIKE ?)");
        queryParams.push(term, term, term);
      }

      if (data.status && data.status !== "all" && data.status.trim()) {
        whereClauses.push("o.status = ?");
        queryParams.push(data.status);
      }

      if (data.startDate && data.startDate.trim()) {
        whereClauses.push("DATE(o.created_at) >= ?");
        queryParams.push(data.startDate);
      }

      if (data.endDate && data.endDate.trim()) {
        whereClauses.push("DATE(o.created_at) <= ?");
        queryParams.push(data.endDate);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      // Count total matching records
      const countResult = await rows<{ total: number }>(
        c,
        `SELECT COUNT(*) as total FROM orders o LEFT JOIN users u ON u.user_id=o.user_id ${whereSql}`,
        queryParams,
      );
      const total = Number(countResult[0]?.total ?? 0);

      // Fetch matching paginated orders
      const ordersSql = `      SELECT o.order_id,o.user_id,o.total,o.status,o.address,o.is_paid,o.payment_method,o.internal_notes,DATE(o.created_at) created_at,u.name customer
        FROM orders o LEFT JOIN users u ON u.user_id=o.user_id
        ${whereSql}
        ORDER BY o.order_id DESC
        LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}`;

      const os = await rows<Omit<Order, "items"> & { customer: string }>(c, ordersSql, queryParams);

      if (!os.length) {
        return {
          orders: [],
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        };
      }

      const orderIds = os.map((o) => o.order_id);
      const items = await rows<{
        order_id: number;
        product_id: number;
        product_name: string;
        quantity: number;
        unit_price: number;
      }>(
        c,
        `SELECT order_id,product_id,product_name,quantity,unit_price FROM order_items WHERE order_id IN (${orderIds.map(() => "?").join(",")})`,
        orderIds,
      );

      const combinedOrders = os.map((o) => ({
        ...o,
        items: items.filter((i) => i.order_id === o.order_id),
      }));

      // Staff must not see money totals on orders
      const ordersOut = isStaff
        ? combinedOrders.map((o) => ({
            ...o,
            total: 0,
            items: o.items.map((it) => ({ ...it, unit_price: 0 })),
          }))
        : combinedOrders;

      return {
        orders: ordersOut,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      };
    });
  });

export interface CustomerSummary {
  id: string;
  user_id: number | null;
  name: string;
  email: string;
  phone: string;
  role: "customer" | "admin" | "staff" | "guest";
  is_active: number;
  orders_count: number;
  total_spent: number;
  created_at: string;
  is_guest: boolean;
}

export async function loadUnifiedCustomers(c: mysql.Connection): Promise<CustomerSummary[]> {
  // 1. Registered users
  const registeredUsers = await rows<{
    user_id: number;
    name: string;
    email: string;
    phone: string | null;
    role: "customer" | "admin" | "staff";
    is_active: number;
    created_at: string;
  }>(
    c,
    `SELECT u.user_id, u.name, u.email, u.phone,
            COALESCE((SELECT r.role FROM user_roles r WHERE r.user_id=u.user_id LIMIT 1), u.role) as role,
            u.is_active,
            DATE(u.created_at) as created_at
     FROM users u`,
  );

  // 2. All orders with guest access email and contact details
  const orders = await rows<{
    order_id: number;
    user_id: number | null;
    email: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    total: number;
    status: string;
    created_at: string;
  }>(
    c,
    `SELECT o.order_id, o.user_id, oa.email, o.customer_name, o.customer_phone, o.total, o.status, DATE(o.created_at) as created_at
     FROM orders o
     LEFT JOIN order_access oa ON oa.order_id = o.order_id`,
  );

  // 3. All quote requests
  const quotes = await rows<{
    quote_id: number;
    user_id: number | null;
    name: string;
    email: string;
    created_at: string;
  }>(
    c,
    `SELECT quote_id, user_id, name, email, DATE(created_at) as created_at
     FROM quote_requests`,
  );

  // 4. All contact messages
  const messages = await rows<{
    id: number;
    name: string;
    email: string;
    phone: string | null;
    created_at: string;
  }>(
    c,
    `SELECT id, name, email, phone, DATE(created_at) as created_at
     FROM contact_messages`,
  );

  // 5. All support tickets
  const tickets = await rows<{
    id: number;
    user_id: number | null;
    customer_name: string;
    customer_email: string;
    created_at: string;
  }>(
    c,
    `SELECT id, user_id, customer_name, customer_email, DATE(created_at) as created_at
     FROM support_tickets`,
  );

  const customerMap = new Map<string, CustomerSummary>();
  const userToEmail = new Map<number, string>();

  // Seed with registered users
  for (const u of registeredUsers) {
    const key = (u.email || "").trim().toLowerCase();
    if (!key) continue;
    userToEmail.set(u.user_id, key);
    customerMap.set(key, {
      id: String(u.user_id),
      user_id: u.user_id,
      name: u.name || "Unnamed User",
      email: u.email,
      phone: u.phone || "",
      role: u.role || "customer",
      is_active: u.is_active ?? 1,
      orders_count: 0,
      total_spent: 0,
      created_at: u.created_at,
      is_guest: false,
    });
  }

  // Helper to ensure customer exists in map
  const getOrCreate = (
    emailRaw: string | null | undefined,
    fallbackName?: string | null,
    fallbackPhone?: string | null,
    fallbackDate?: string | null,
    userId?: number | null,
  ): CustomerSummary | null => {
    let key = (emailRaw || "").trim().toLowerCase();
    if (!key && userId && userToEmail.has(userId)) {
      key = userToEmail.get(userId)!;
    }
    if (!key) return null;

    let cust = customerMap.get(key);
    if (!cust) {
      cust = {
        id: `guest-${key}`,
        user_id: userId ?? null,
        name: fallbackName?.trim() || "Guest Customer",
        email: emailRaw?.trim() || key,
        phone: fallbackPhone?.trim() || "",
        role: "guest",
        is_active: 1,
        orders_count: 0,
        total_spent: 0,
        created_at: fallbackDate || new Date().toISOString().slice(0, 10),
        is_guest: true,
      };
      customerMap.set(key, cust);
    } else {
      if (fallbackPhone && !cust.phone) cust.phone = fallbackPhone.trim();
      if (cust.is_guest && (!cust.name || cust.name === "Guest Customer") && fallbackName?.trim()) {
        cust.name = fallbackName.trim();
      }
      if (fallbackDate && (!cust.created_at || fallbackDate < cust.created_at)) {
        cust.created_at = fallbackDate;
      }
    }
    return cust;
  };

  // Process orders
  for (const o of orders) {
    let email: string | null = o.email ?? null;
    if (!email && o.user_id) {
      email = userToEmail.get(o.user_id) ?? null;
    }
    const cust = getOrCreate(email, o.customer_name, o.customer_phone, o.created_at, o.user_id);
    if (cust) {
      cust.orders_count += 1;
      // Calculate spending from eligible completed orders using defined business rules (status = 'Delivered')
      if (o.status === "Delivered") {
        cust.total_spent += Number(o.total || 0);
      }
      if (o.customer_name && cust.is_guest && cust.name === "Guest Customer") {
        cust.name = o.customer_name;
      }
      if (o.customer_phone && !cust.phone) {
        cust.phone = o.customer_phone;
      }
    }
  }

  // Process quotes
  for (const q of quotes) {
    let email: string | null = q.email || null;
    if (!email && q.user_id) {
      email = userToEmail.get(q.user_id) ?? null;
    }
    const cust = getOrCreate(email, q.name, null, q.created_at, q.user_id);
    if (cust && cust.is_guest && q.name && cust.name === "Guest Customer") {
      cust.name = q.name;
    }
  }

  // Process messages
  for (const m of messages) {
    const cust = getOrCreate(m.email, m.name, m.phone, m.created_at);
    if (cust) {
      if (cust.is_guest && m.name && cust.name === "Guest Customer") cust.name = m.name;
      if (m.phone && !cust.phone) cust.phone = m.phone;
    }
  }

  // Process support tickets
  for (const t of tickets) {
    let email: string | null = t.customer_email || null;
    if (!email && t.user_id) {
      email = userToEmail.get(t.user_id) ?? null;
    }
    const cust = getOrCreate(email, t.customer_name, null, t.created_at, t.user_id);
    if (cust && cust.is_guest && t.customer_name && cust.name === "Guest Customer") {
      cust.name = t.customer_name;
    }
  }

  const list = Array.from(customerMap.values());
  // Sort: highest completed spending first, then order count, then newest
  list.sort(
    (a, b) =>
      b.total_spent - a.total_spent ||
      b.orders_count - a.orders_count ||
      b.created_at.localeCompare(a.created_at),
  );
  return list;
}

export const getCustomers = createServerFn({ method: "GET" }).handler(async () => {
  const u = await requirePermission("customers.view");
  const isStaff = u.role === "staff";
  return withDb(async (c) => {
    const list = await loadUnifiedCustomers(c);
    if (isStaff) {
      return list.map((cust) => ({
        ...cust,
        total_spent: 0,
      }));
    }
    return list;
  });
});

const productInput = z.object({
  product_id: z.number().int().min(0),
  name: z.string().trim().min(1).max(150),
  sku: z.string().trim().max(80).optional().nullable(),
  slug: z.string().trim().max(200).optional().nullable(),
  category: z.enum(CATEGORIES),
  capacity: z.string().trim().max(40).optional().nullable(),
  price: z.number().positive().max(1e9),
  stock: z.number().int().min(0).max(1e7),
  image: z.string().trim().max(500),
  description: z.string().trim().max(2000),
  status: z.enum(["active", "draft", "archived"]).default("active"),
});

export const saveProduct = createServerFn({ method: "POST" })
  .validator((d) => productInput.parse(d))
  .handler(async ({ data }) => {
    const requiredPerm = data.product_id === 0 ? "products.create" : "products.update";
    const u = await requirePermission(requiredPerm);
    let productId = data.product_id;
    await withDb(async (c) => {
      const cat = (
        await rows<{ category_id: number }>(c, "SELECT category_id FROM categories WHERE name=?", [
          data.category as Category,
        ])
      )[0];
      if (!cat) throw new Error("Unknown category.");

      // SKU/slug uniqueness validation — check before writing so duplicates
      // return friendly errors instead of DB unique-constraint violations.
      const trimSku = (data.sku ?? "").trim();
      const trimSlug = (data.slug ?? "").trim();

      if (data.product_id === 0) {

        if (trimSku) {
          const dup = await rows(c, "SELECT 1 FROM products WHERE sku=?", [trimSku]);
          if (dup.length) throw new Error(`SKU "${trimSku}" is already in use.`);
        }

        if (trimSlug) {
          const dup = await rows(c, "SELECT 1 FROM products WHERE slug=?", [trimSlug]);
          if (dup.length) throw new Error(`Slug "${trimSlug}" is already in use.`);
        }

        const v = [
          cat.category_id,
          data.name,
          data.capacity || null,
          data.price,
          data.stock,
          data.image,
          data.description,
        ];
        const [r] = await c.execute(
          "INSERT INTO products (category_id,name,capacity,price,stock,image,description) VALUES (?,?,?,?,?,?,?)",
          v,
        );
        productId = (r as { insertId: number }).insertId;

        // Auto-generate sku/slug if not supplied
        const finalSku = trimSku || `PF-${String(productId).padStart(5, "0")}`;
        const baseSlug =
          trimSlug ||
          data.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
        await c.execute("UPDATE products SET sku=?, slug=?, status=? WHERE product_id=?", [
          finalSku,
          baseSlug,
          data.status ?? "active",
          productId,
        ]);
        await logAction(null, "CREATE_PRODUCT", "product", productId, null, data);
      } else {
        const oldRows = await rows<Product>(c, `${PRODUCT_SQL} AND p.product_id=?`, [
          data.product_id,
        ]);
        const oldProduct = oldRows[0] ?? null;
        if (!oldProduct) throw new Error("Product not found.");

        if (u.role === "staff" && Number(oldProduct.price) !== Number(data.price)) {
          const err = new Error("Staff members are not permitted to modify product prices.");
          (err as any).statusCode = 403;
          throw err;
        }

        // Uniqueness checks for edits (exclude the product itself).
        if (trimSku && trimSku !== (oldProduct.sku ?? "")) {
          const dup = await rows(c, "SELECT 1 FROM products WHERE sku=? AND product_id!=?", [
            trimSku,
            data.product_id,
          ]);
          if (dup.length) throw new Error(`SKU "${trimSku}" is already in use.`);
        }

        if (trimSlug && trimSlug !== (oldProduct.slug ?? "")) {
          const dup = await rows(c, "SELECT 1 FROM products WHERE slug=? AND product_id!=?", [
            trimSlug,
            data.product_id,
          ]);
          if (dup.length) throw new Error(`Slug "${trimSlug}" is already in use.`);
        }

        const effectivePrice = u.role === "staff" ? oldProduct.price : data.price;
        const effectiveStatus = (data as any).status ?? "active";
        const v = [
          cat.category_id,
          data.name,
          data.capacity || null,
          effectivePrice,
          data.stock,
          data.image,
          data.description,
          effectiveStatus,
        ];
        await c.execute(
          "UPDATE products SET category_id=?,name=?,capacity=?,price=?,stock=?,image=?,description=?,status=? WHERE product_id=?",
          [...v, data.product_id],
        );
        // Option A: write a stock_movements record when admin edits the stock field directly
        const stockDiff = data.stock - Number(oldProduct.stock);
        if (stockDiff !== 0) {
          await c.execute(
            `INSERT INTO stock_movements (product_id, quantity, type, reference_type, reference_id, note)
             VALUES (?, ?, ?, 'admin_edit', ?, ?)`,
            [
              data.product_id,
              Math.abs(stockDiff),
              stockDiff > 0 ? "in" : "out",
              u.user_id,
              `Admin product edit by ${u.name}`,
            ],
          );
        }
        await logAction(null, "UPDATE_PRODUCT", "product", data.product_id, oldProduct, {
          ...data,
          price: effectivePrice,
        });
      }
    });
    return { ok: true, product_id: productId };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .validator((d) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission("products.delete");
    await withDb(async (c) => {
      const oldRows = await rows<Product>(c, `${PRODUCT_SQL} AND p.product_id=?`, [data.id]);
      const oldProduct = oldRows[0] ?? null;
      await c.execute("DELETE FROM products WHERE product_id=?", [data.id]);
      await logAction(null, "DELETE_PRODUCT", "product", data.id, oldProduct, null);
    });
    return { ok: true };
  });

export const setOrderStatus = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        id: z.number().int(),
        status: z.enum(ORDER_STATUSES),
        notes: z.string().optional(),
        customer_message: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requirePermission("orders.update_status");
    let orderUserId: number | null = null;
    const newStatus = data.status as OrderStatus;
    // Overwritten from the row inside the transaction; initialised to the
    // requested status so the post-commit block always has a sane value.
    let prevStatus: OrderStatus = newStatus;
    await withDb(async (c) => {
      await c.beginTransaction();
      try {
        const [existing] = await rows<{
          order_id: number;
          user_id: number | null;
          status: OrderStatus;
          is_paid: number;
          payment_method: string;
        }>(
          c,
          "SELECT order_id, user_id, status, is_paid, payment_method FROM orders WHERE order_id=? FOR UPDATE",
          [data.id],
        );
        if (!existing) throw new Error("Order not found.");

        orderUserId = existing.user_id;
        prevStatus = existing.status;

        // Same transition rules for staff and admin: the shared table is the
        // single source of truth, so no role can skip a stage or revive a
        // terminal order.
        if (!canTransition(prevStatus, newStatus)) {
          throw new InvalidTransitionError(prevStatus, newStatus);
        }

        // Delivery requires payment, unless it is Cash on Delivery. Applies to
        // every role — guests can never reach this endpoint, and staff cannot
        // bypass the rule.
        if (newStatus === "Delivered") {
          const isPaid = existing.is_paid === 1;
          const isCod = existing.payment_method?.toLowerCase() === "cash_on_delivery";
          if (!isPaid && !isCod) {
            const err = new Error(
              "Order cannot be marked delivered until it has been paid or confirmed Cash on Delivery.",
            );
            (err as any).statusCode = 403;
            throw err;
          }
        }

        // Restore stock when order is cancelled from any status before 'Delivered'.
        // changeStock() locks each product row with FOR UPDATE before updating,
        // which closes the race condition in the old bare UPDATE … SET stock + ?.
        // Do NOT deduct again on 'Confirmed'.
        if (newStatus === "Cancelled" && prevStatus !== "Cancelled" && prevStatus !== "Delivered") {
          const items = await rows<{ product_id: number; quantity: number }>(
            c,
            "SELECT product_id, quantity FROM order_items WHERE order_id=?",
            [data.id],
          );
          for (const item of items) {
            if (item.product_id) {
              await changeStock(
                c,
                item.product_id,
                +item.quantity,
                `Order #${data.id} cancelled — stock restored`,
                "order",
                data.id,
                u.user_id,
              );
            }
          }
        }

        await c.execute("UPDATE orders SET status=? WHERE order_id=?", [newStatus, data.id]);

        // Insert into order_status_history (staff-facing; never sent to customers)
        await c.execute(
          "INSERT INTO order_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)",
          [data.id, newStatus, data.notes ?? null, u.user_id],
        );

        // Dispatch and delivery completion are recorded once, on the order's
        // own delivery row.
        if (newStatus === "Out for Delivery" && prevStatus !== "Out for Delivery") {
          await c.execute("INSERT IGNORE INTO order_deliveries (order_id) VALUES (?)", [data.id]);
          await c.execute(
            "UPDATE order_deliveries SET dispatched_at=NOW(), dispatched_by=? WHERE order_id=? AND dispatched_at IS NULL",
            [u.user_id, data.id],
          );
        }

        if (newStatus === "Delivered") {
          await c.execute("INSERT IGNORE INTO order_deliveries (order_id) VALUES (?)", [data.id]);
          // delivered_at IS NULL guard makes a retried/double submission
          // record the completion exactly once.
          await c.execute(
            "UPDATE order_deliveries SET delivered_at=NOW(), delivered_by=?, delivered_by_name=? WHERE order_id=? AND delivered_at IS NULL",
            [u.user_id, u.name, data.id],
          );
        }

        // Customer-visible feed entry. `notes` stays internal; only an explicit
        // customer_message is ever shown to the customer.
        await pushCustomerOrderUpdate(
          c,
          data.id,
          newStatus === "Delivered" ? "delivery" : "status",
          data.customer_message ?? null,
          prevStatus,
          newStatus,
        );

        await c.commit();
      } catch (err) {
        await c.rollback().catch(() => {});
        throw err;
      }
    });

    // Notify the customer: in-app for registered buyers, email for everyone
    // (guests have no notifications row because user_id is NOT NULL there).
    await notify(
      orderUserId,
      "order_status",
      `Order #${data.id} ${newStatus}`,
      `Your order #${data.id} status has been updated to ${newStatus}.`,
      "/track-order",
    );
    await emailOrderCustomer(data.id, newStatus);

    // Audit log
    await logAction(
      null,
      "UPDATE_ORDER_STATUS",
      "order",
      data.id,
      { status: prevStatus },
      { status: newStatus, notes: data.notes },
    );
    return { ok: true };
  });

// ─── delivery management ──────────────────────────────────────────────────────

const DELIVERY_SELECT = `SELECT dv.order_id, dv.assigned_to, dv.delivery_notes, dv.expected_delivery_date,
      dv.dispatched_at, dv.dispatched_by, dv.dispatched_note,
      dv.delivered_at, dv.delivered_by, dv.delivered_by_name,
      dv.completion_notes, dv.confirmation_name, dv.confirmation_details,
      a.name AS assigned_name
   FROM order_deliveries dv
   LEFT JOIN users a ON a.user_id = dv.assigned_to`;

interface DeliveryRow {
  order_id: number;
  assigned_to: number | null;
  delivery_notes: string | null;
  expected_delivery_date: string | null;
  dispatched_at: string | null;
  dispatched_by: number | null;
  dispatched_note: string | null;
  delivered_at: string | null;
  delivered_by: number | null;
  delivered_by_name: string | null;
  completion_notes: string | null;
  confirmation_name: string | null;
  confirmation_details: string | null;
  assigned_name: string | null;
}

export const getOrderDelivery = createServerFn({ method: "POST" })
  .validator((d) => z.object({ order_id: z.number().int().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission("orders.view");
    return withDb(async (c) => {
      const [order] = await rows<{
        status: OrderStatus;
        is_paid: number;
        payment_method: string;
        address: string;
      }>(c, "SELECT status, is_paid, payment_method, address FROM orders WHERE order_id = ?", [
        data.order_id,
      ]);
      if (!order) throw new Error("Order not found.");

      const [delivery] = await rows<DeliveryRow>(c, `${DELIVERY_SELECT} WHERE dv.order_id = ?`, [
        data.order_id,
      ]);

      const contact = await loadOrderContact(c, data.order_id);
      const assignable = await rows<{ user_id: number; name: string; role: string }>(
        c,
        "SELECT user_id, name, role FROM users WHERE role IN ('staff','admin') AND COALESCE(is_active,1)=1 ORDER BY name",
      );

      return {
        order_id: data.order_id,
        status: order.status,
        is_paid: order.is_paid === 1,
        payment_method: order.payment_method,
        address: order.address,
        delivery: delivery ?? null,
        customer_phone: contact?.phone ?? null,
        customer_name: contact?.name ?? null,
        assignable,
        next_statuses: nextStatuses(order.status),
      };
    });
  });

export const saveDeliveryInfo = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        order_id: z.number().int().min(1),
        assigned_to: z.number().int().min(1).nullable().optional(),
        delivery_notes: z.string().max(2000).nullable().optional(),
        expected_delivery_date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requirePermission("orders.update_status");
    await withDb(async (c) => {
      await c.beginTransaction();
      try {
        const [order] = await rows<{ order_id: number }>(
          c,
          "SELECT order_id FROM orders WHERE order_id = ? FOR UPDATE",
          [data.order_id],
        );
        if (!order) throw new Error("Order not found.");

        // Upsert: the row is created on first save and updated afterwards.
        await c.execute(
          `INSERT INTO order_deliveries (order_id, assigned_to, delivery_notes, expected_delivery_date)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             assigned_to = VALUES(assigned_to),
             delivery_notes = VALUES(delivery_notes),
             expected_delivery_date = VALUES(expected_delivery_date)`,
          [
            data.order_id,
            data.assigned_to ?? null,
            data.delivery_notes ?? null,
            data.expected_delivery_date ?? null,
          ],
        );
        await c.commit();
      } catch (e) {
        await c.rollback().catch(() => {});
        throw e;
      }
    });

    await logAction(null, "UPDATE_ORDER_DELIVERY", "order", data.order_id, null, {
      assigned_to: data.assigned_to ?? null,
      expected_delivery_date: data.expected_delivery_date ?? null,
      has_notes: !!data.delivery_notes,
    });
    return { ok: true };
  });

export const recordOrderDispatch = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        order_id: z.number().int().min(1),
        note: z.string().max(255).optional(),
        customer_message: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requirePermission("orders.update_status");
    let from: OrderStatus = "Pending";
    let orderUserId: number | null = null;

    await withDb(async (c) => {
      await c.beginTransaction();
      try {
        const [order] = await rows<{ status: OrderStatus; user_id: number | null }>(
          c,
          "SELECT status, user_id FROM orders WHERE order_id = ? FOR UPDATE",
          [data.order_id],
        );
        if (!order) throw new Error("Order not found.");
        from = order.status;
        orderUserId = order.user_id;

        if (!canTransition(from, "Out for Delivery")) {
          throw new InvalidTransitionError(from, "Out for Delivery");
        }

        await c.execute("INSERT IGNORE INTO order_deliveries (order_id) VALUES (?)", [
          data.order_id,
        ]);
        // dispatched_at IS NULL again: re-dispatching keeps the first timestamp.
        await c.execute(
          "UPDATE order_deliveries SET dispatched_at=NOW(), dispatched_by=?, dispatched_note=? WHERE order_id=? AND dispatched_at IS NULL",
          [u.user_id, data.note ?? null, data.order_id],
        );

        await c.execute("UPDATE orders SET status='Out for Delivery' WHERE order_id=?", [
          data.order_id,
        ]);
        await c.execute(
          "INSERT INTO order_status_history (order_id, status, notes, changed_by) VALUES (?, 'Out for Delivery', ?, ?)",
          [data.order_id, data.note ?? null, u.user_id],
        );

        await pushCustomerOrderUpdate(
          c,
          data.order_id,
          "delivery",
          data.customer_message ?? "Your order is out for delivery.",
          from,
          "Out for Delivery",
        );
        await c.commit();
      } catch (e) {
        await c.rollback().catch(() => {});
        throw e;
      }
    });

    // In-app notification for registered buyers; guests are reached by email
    // only (notifications.user_id cannot be null).
    await notify(
      orderUserId,
      "order_status",
      `Order #${data.order_id} Out for Delivery`,
      `Your order #${data.order_id} is now out for delivery.`,
      "/track-order",
      { dedupeKey: `order-dispatch:${data.order_id}` },
    );
    await emailOrderCustomer(data.order_id, "Out for Delivery");
    await logAction(
      null,
      "DISPATCH_ORDER",
      "order",
      data.order_id,
      { status: from },
      {
        status: "Out for Delivery",
      },
    );
    return { ok: true };
  });

// ─── public guest tracking (session proves ownership) ────────────────────────
// The verified session carries only the order id, so every request here can
// be gated on session ownership — no password is ever sent again.

export const getGuestOrderStatus = createServerFn({ method: "POST" })
  .validator((d) => z.object({ order_id: z.number().int().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const sessionOrderId = await requireOrderSession();
    assertOrderOwnership(sessionOrderId, data.order_id);

    return withDb(async (c) => {
      const [order] = await rows<{
        order_id: number;
        user_id: number | null;
        total: number;
        status: OrderStatus;
        address: string;
        is_paid: number;
        payment_method: string;
        order_number: string | null;
        created_at: string;
      }>(
        c,
        `SELECT o.order_id, o.user_id, o.total, o.status, o.address, o.is_paid,
                o.payment_method, o.order_number, DATE(o.created_at) created_at
         FROM orders o WHERE o.order_id = ?`,
        [data.order_id],
      );
      if (!order) throw new Error("Order not found.");

      const items = await rows<{
        product_id: number;
        product_name: string;
        quantity: number;
        unit_price: number;
      }>(
        c,
        "SELECT product_id, product_name, quantity, unit_price FROM order_items WHERE order_id = ?",
        [data.order_id],
      );

      const messages = await rows<{
        id: number;
        sender_type: string;
        sender_name: string;
        kind: string;
        body: string | null;
        status_from: string | null;
        status_to: string | null;
        created_at: string;
      }>(c, `${MESSAGE_SELECT} WHERE m.order_id = ? ORDER BY m.id ASC`, [data.order_id]);

      const [delivery] = await rows<DeliveryRow>(c, `${DELIVERY_SELECT} WHERE dv.order_id = ?`, [
        data.order_id,
      ]);

      await c.execute(
        "UPDATE order_messages SET is_read_by_customer = 1 WHERE order_id = ? AND sender_type <> 'customer'",
        [data.order_id],
      );

      return {
        order: {
          order_id: order.order_id,
          order_number: order.order_number,
          user_id: order.user_id,
          total: order.total,
          status: order.status,
          address: order.address,
          is_paid: order.is_paid === 1,
          payment_method: order.payment_method,
          created_at: order.created_at,
        },
        items,
        messages,
        delivery: delivery ?? null,
      };
    });
  });

export const completeOrderDelivery = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        order_id: z.number().int().min(1),
        completion_notes: z.string().max(2000).optional(),
        confirmation_name: z.string().max(100).optional(),
        confirmation_details: z.string().max(255).optional(),
        customer_message: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requirePermission("orders.update_status");

    const result = await withDb(async (c) => {
      await c.beginTransaction();
      try {
        const [order] = await rows<{
          status: OrderStatus;
          is_paid: number;
          payment_method: string;
        }>(c, "SELECT status, is_paid, payment_method FROM orders WHERE order_id = ? FOR UPDATE", [
          data.order_id,
        ]);
        if (!order) throw new Error("Order not found.");

        if (order.status === "Delivered") {
          // Idempotent: a retried request reports the existing completion
          // instead of writing a second one.
          const [done] = await rows<{ delivered_at: string | null }>(
            c,
            "SELECT delivered_at FROM order_deliveries WHERE order_id = ?",
            [data.order_id],
          );
          await c.rollback().catch(() => {});
          return { already: true, delivered_at: done?.delivered_at ?? null };
        }

        if (!canTransition(order.status, "Delivered")) {
          throw new InvalidTransitionError(order.status, "Delivered");
        }

        // Payment rule is enforced for every role.
        const isPaid = order.is_paid === 1;
        const isCod = order.payment_method?.toLowerCase() === "cash_on_delivery";
        if (!isPaid && !isCod) {
          const err = new Error(
            "Order cannot be marked delivered until it has been paid or confirmed Cash on Delivery.",
          );
          (err as any).statusCode = 403;
          throw err;
        }

        await c.execute("INSERT IGNORE INTO order_deliveries (order_id) VALUES (?)", [
          data.order_id,
        ]);
        await c.execute(
          `UPDATE order_deliveries SET
             delivered_at = NOW(), delivered_by = ?, delivered_by_name = ?,
             completion_notes = ?, confirmation_name = ?, confirmation_details = ?
           WHERE order_id = ? AND delivered_at IS NULL`,
          [
            u.user_id,
            u.name,
            data.completion_notes ?? null,
            data.confirmation_name ?? null,
            data.confirmation_details ?? null,
            data.order_id,
          ],
        );

        await c.execute("UPDATE orders SET status='Delivered' WHERE order_id=?", [data.order_id]);
        await c.execute(
          "INSERT INTO order_status_history (order_id, status, notes, changed_by) VALUES (?, 'Delivered', ?, ?)",
          [data.order_id, data.completion_notes ?? null, u.user_id],
        );

        await pushCustomerOrderUpdate(
          c,
          data.order_id,
          "delivery",
          data.customer_message ?? "Your order has been delivered. Thank you!",
          order.status,
          "Delivered",
        );
        await c.commit();
        return { already: false };
      } catch (e) {
        await c.rollback().catch(() => {});
        throw e;
      }
    });

    // Delivered orders feed the delivered-order reports through orders.status,
    // which is what the existing report queries filter on, so no extra
    // reporting write is required.
    await emailOrderCustomer(data.order_id, "Delivered");
    if (!result.already) {
      await logAction(null, "COMPLETE_ORDER_DELIVERY", "order", data.order_id, null, {
        confirmation_name: data.confirmation_name ?? null,
      });
    }
    return result;
  });

export const addOrderNote = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({ order_id: z.number().int(), note: z.string().trim().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requirePermission("orders.add_note");
    return withDb(async (c) => {
      const [ord] = await rows<{ order_id: number; internal_notes: string | null }>(
        c,
        "SELECT order_id, internal_notes FROM orders WHERE order_id=?",
        [data.order_id],
      );
      if (!ord) throw new Error("Order not found.");

      const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
      const newEntry = `[${timestamp} - ${u.name}]: ${data.note}`;
      const combined = ord.internal_notes ? `${ord.internal_notes}\n${newEntry}` : newEntry;

      await c.execute("UPDATE orders SET internal_notes=? WHERE order_id=?", [
        combined,
        data.order_id,
      ]);
      await c.execute(
        "INSERT INTO order_status_history (order_id, status, notes, changed_by) VALUES (?, 'Note Added', ?, ?)",
        [data.order_id, data.note, u.user_id],
      );
      await logAction(null, "ADD_ORDER_NOTE", "order", data.order_id, null, { note: data.note });
      return { ok: true, notes: combined };
    });
  });

export const getOrderStatusHistory = createServerFn({ method: "POST" })
  .validator((d) => z.object({ order_id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission("orders.view");
    return withDb((c) =>
      rows<{
        id: number;
        order_id: number;
        status: string;
        notes: string | null;
        changed_by: number | null;
        changer_name: string | null;
        created_at: string;
      }>(
        c,
        `SELECT osh.id, osh.order_id, osh.status, osh.notes, osh.changed_by, u.name changer_name, osh.created_at
         FROM order_status_history osh
         LEFT JOIN users u ON u.user_id = osh.changed_by
         WHERE osh.order_id=?
         ORDER BY osh.id DESC`,
        [data.order_id],
      ),
    );
  });

export const setQuoteStatus = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        id: z.number().int(),
        status: z.enum(QUOTE_STATUSES).optional(),
        quoted_amount: z.number().positive().optional().nullable(),
        valid_until: z.string().optional().nullable(),
        reply_message: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requirePermission("quotes.respond");
    return withDb(async (c) => {
      const [existing] = await rows<{
        quote_id: number;
        user_id: number | null;
        email: string;
        status: QuoteStatus;
      }>(c, "SELECT quote_id, user_id, email, status FROM quote_requests WHERE quote_id=?", [
        data.id,
      ]);
      if (!existing) throw new Error("Quote request not found.");

      const prevStatus = existing.status;
      const amount = data.quoted_amount ? Number(data.quoted_amount) : null;

      // Check quote limit for staff
      const [limitRow] = await rows<{ setting_value: string }>(
        c,
        "SELECT setting_value FROM app_settings WHERE setting_key='staff_quote_limit'",
      );
      const quoteLimit = Number(limitRow?.setting_value ?? 100000);

      if (u.role === "staff" && amount !== null && amount > quoteLimit) {
        // Staff quote exceeds limit -> must go to Pending Approval, not sent to customer yet
        await c.execute(
          "UPDATE quote_requests SET status='Pending Approval', quoted_amount=?, valid_until=?, assigned_to=? WHERE quote_id=?",
          [amount, data.valid_until || null, u.user_id, data.id],
        );
        await logAction(
          null,
          "REQUEST_QUOTE_APPROVAL",
          "quote",
          data.id,
          { status: prevStatus },
          {
            status: "Pending Approval",
            quoted_amount: amount,
            valid_until: data.valid_until,
          },
        );
        return {
          ok: true,
          pendingApproval: true,
          message: `Quote amount (${amount} ETB) exceeds staff threshold of ${quoteLimit} ETB and has been submitted for admin approval.`,
        };
      }

      const newStatus = data.status ?? "Replied";
      await c.execute(
        "UPDATE quote_requests SET status=?, quoted_amount=?, valid_until=?, assigned_to=? WHERE quote_id=?",
        [newStatus, amount, data.valid_until || null, u.user_id, data.id],
      );

      let targetUserId = existing.user_id;
      if (!targetUserId && existing.email) {
        const userRow = await rows<{ user_id: number }>(
          c,
          "SELECT user_id FROM users WHERE email=?",
          [existing.email.toLowerCase()],
        );
        if (userRow[0]) targetUserId = userRow[0].user_id;
      }

      await notify(
        targetUserId,
        "quote_status",
        `Quote Request #${existing.quote_id} Updated`,
        data.reply_message
          ? data.reply_message
          : `Your quote request status has been updated to ${newStatus}.${amount ? ` Quoted amount: ETB ${amount.toLocaleString()}` : ""}`,
        "/track-order",
      );

      // Save reply to quote_replies table and email customer via conversation link
      let conversationToken: string | null = null;
      if (data.reply_message) {
        const cleanText = sanitizeMessage(data.reply_message);

        await c.execute(
          `INSERT INTO quote_replies (quote_id, sender_type, sender_name, reply_text, is_internal)
           VALUES (?, 'staff', ?, ?, 0)`,
          [data.id, u.name, cleanText],
        );

        // Create or refresh a conversation token and email the customer
        const deleted = await c.execute(
          `DELETE FROM conversation_tokens WHERE conversation_type = 'quote' AND conversation_id = ?`,
          [data.id],
        );
        conversationToken = await createConversationToken("quote", data.id, existing.email);

        const conversationUrl = `https://polarfiber.com.et/conversation/${conversationToken}`;
        const expiresInDays = CONVERSATION_TOKEN_VALID_DAYS;

        await import("./email").then((emailMod) =>
          emailMod.sendConversationNotificationEmail({
            to: existing.email,
            subject: `Quote #${existing.quote_id} Update`,
            text:
              `Hello,\n\nYour quote request #${existing.quote_id} has been updated.\n\n` +
              `Staff reply: ${data.reply_message}\n\n` +
              `You can view and respond to this conversation securely via:\n${conversationUrl}\n\n` +
              `This link expires in ${expiresInDays} days.\n\n` +
              `Thank you for choosing Polar Fiber!`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #0ea5e9;">Quote Update — #${existing.quote_id}</h2>
                <p>Your quote request has been updated by our team.</p>
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 15px 0;">
                  <p style="margin: 0;"><strong>"Staff Reply:</strong></p>
                  <p style="margin: 5px 0 0 0;">${cleanText.replace(/\n/g, "<br/>")}</p>
                </div>
                <p>To view this conversation and reply, use your secure link below (expires in ${expiresInDays} days):</p>
                <p style="margin: 15px 0;"><a href="${conversationUrl}" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Conversation</a></p>
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;" />
                <p style="color: #64748b; font-size: 14px;">Thank you for choosing Polar Fiber!</p>
              </div>`,
            conversationUrl,
            expiresInDays,
            ctx: { conversationType: "quote", conversationId: data.id },
          }),
        );
      }

      await logAction(
        null,
        "UPDATE_QUOTE_STATUS",
        "quote",
        data.id,
        { status: prevStatus },
        { status: newStatus, quoted_amount: amount },
      );
      return { ok: true };
    });
  });

export const approveQuote = createServerFn({ method: "POST" })
  .validator((d) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    return withDb(async (c) => {
      const [q] = await rows<Quote>(c, "SELECT * FROM quote_requests WHERE quote_id=?", [data.id]);
      if (!q) throw new Error("Quote request not found.");
      if (q.status !== "Pending Approval") throw new Error("Quote is not pending approval.");

      await c.execute("UPDATE quote_requests SET status='Replied' WHERE quote_id=?", [data.id]);

      let targetUserId = q.user_id;
      if (!targetUserId && q.email) {
        const u = await rows<{ user_id: number }>(c, "SELECT user_id FROM users WHERE email=?", [
          q.email.toLowerCase(),
        ]);
        if (u[0]) targetUserId = u[0].user_id;
      }
      await notify(
        targetUserId,
        "quote_status",
        `Quote Request #${q.quote_id} Approved & Ready`,
        `Your quote request has been approved with quote amount: ETB ${Number(q.quoted_amount).toLocaleString()}.`,
        "/track-order",
      );
      await logAction(
        null,
        "APPROVE_QUOTE",
        "quote",
        data.id,
        { status: "Pending Approval" },
        { status: "Replied" },
      );
      return { ok: true };
    });
  });

export const convertQuoteToOrder = createServerFn({ method: "POST" })
  .validator((d) => z.object({ quote_id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const u = await requireAdmin();
    return withDb(async (c) => {
      const [q] = await rows<{
        quote_id: number;
        user_id: number | null;
        name: string;
        email: string;
        message: string | null;
        quoted_amount: number | null;
        delivery_location: string | null;
        status: string;
      }>(c, `${QUOTE_SQL} WHERE quote_id=?`, [data.quote_id]);
      if (!q) throw new Error("Quote not found.");
      if (!["Replied", "Reviewing", "New", "Accepted"].includes(q.status))
        throw new Error("Only active quotes (New/Replied/Reviewing/Accepted) can be converted to orders.");
      if (!q.quoted_amount || q.quoted_amount <= 0)
        throw new Error("Quote must have a quoted amount before conversion.");

      // Resolve user_id from email if not set
      let userId = q.user_id;
      if (!userId && q.email) {
        const [ur] = await rows<{ user_id: number }>(c, "SELECT user_id FROM users WHERE email=?", [
          q.email.toLowerCase(),
        ]);
        if (ur) userId = ur.user_id;
      }
      if (!userId) {
        // Guest order — store with NULL user_id, notify via email only
        const { sendOrderStatusEmail } = await import("./email");
        await sendOrderStatusEmail(
          q.email,
          q.name ?? q.email,
          0,
          "Pending",
          q.quoted_amount ?? 0,
        ).catch((err) => {
          console.error("[convertQuoteToOrder] Failed to send guest order email:", err);
        });
      }

      await c.beginTransaction();
      try {
        const addr = q.delivery_location ?? "See quote details";
        const [r] = await c.execute(
          `INSERT INTO orders (user_id, total, status, address, is_paid, payment_method, internal_notes)
           VALUES (?, ?, 'Pending', ?, 0, 'invoice', ?)`,
          [
            userId,
            q.quoted_amount,
            addr,
            `Converted from Quote #${q.quote_id}: ${(q.message ?? "").slice(0, 200)}`,
          ],
        );
        const orderId = (r as { insertId: number }).insertId;

        await c.execute("UPDATE orders SET order_number=? WHERE order_id=?", [
          `PF-ORD-${orderId}`,
          orderId,
        ]);

        // Copy quote line items into order items — no stock deduction at
        // conversion; stock is deducted when the order is confirmed/placed.
        const quoteItems = await rows<{
          product_id: number | null;
          product_name: string;
          quantity: number;
          unit_price: number;
        }>(
          c,
          "SELECT product_id, product_name, quantity, unit_price FROM quote_items WHERE quote_id=?",
          [data.quote_id],
        );
        if (quoteItems.length > 0) {
          for (const it of quoteItems) {
            await c.execute(
              `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
               VALUES (?, ?, ?, ?, ?)`,
              [orderId, it.product_id, it.product_name, it.quantity, it.unit_price],
            );
          }
        } else {
          // Fallback for legacy quotes without line items
          await c.execute(
            `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
             VALUES (?, NULL, ?, 1, ?)`,
            [orderId, `Quote #${q.quote_id} — ${q.email}`, q.quoted_amount],
          );
        }

        await c.execute(
          "INSERT INTO order_status_history (order_id, status, notes, changed_by) VALUES (?, 'Pending', 'Converted from Quote', ?)",
          [orderId, u.user_id],
        );

        await c.execute("UPDATE quote_requests SET status='Closed' WHERE quote_id=?", [
          data.quote_id,
        ]);
        await c.commit();

        await notify(
          userId,
          "order_created",
          `Order #${orderId} Created from Your Quote`,
          `Your quote #${q.quote_id} has been converted to Order #${orderId}.`,
          "/track-order",
        );
        await logAction(
          null,
          "CONVERT_QUOTE_TO_ORDER",
          "quote",
          data.quote_id,
          { status: q.status },
          { order_id: orderId, status: "Closed" },
        );

        return { ok: true, order_id: orderId };
      } catch (e) {
        await c.rollback().catch(() => {});
        throw e;
      }
    });
  });

export const updateProductStock = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        id: z.number().int(),
        stock: z.number().int().min(0).optional(),
        delta: z.number().int().optional(),
        reason: z
          .string()
          .trim()
          .min(1, "A mandatory reason must be provided for stock adjustments."),
      })
      .refine((v) => v.stock !== undefined || v.delta !== undefined, {
        message: "Either stock or delta must be provided.",
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requirePermission("inventory.adjust");
    return withDb(async (c) => {
      // Fast pre-read (no lock) just to compute diff and run the staff limit check.
      // changeStock() will re-read under FOR UPDATE before any mutation.
      const oldRows = await rows<{ stock: number; name: string }>(
        c,
        "SELECT stock, name FROM products WHERE product_id=?",
        [data.id],
      );
      if (!oldRows[0]) throw new Error("Product not found.");
      const oldStock = oldRows[0].stock;
      const targetStock = data.stock !== undefined ? data.stock : oldStock + (data.delta ?? 0);
      if (targetStock < 0) throw new Error("Stock cannot be negative.");
      const diff = targetStock - oldStock;
      const absQty = Math.abs(diff);

      // Check setting for stock adjustment limit
      const [limitRow] = await rows<{ setting_value: string }>(
        c,
        "SELECT setting_value FROM app_settings WHERE setting_key='stock_adjust_limit'",
      );
      const stockLimit = Number(limitRow?.setting_value ?? 50);

      if (u.role === "staff" && absQty > stockLimit) {
        // Exceeds limit → queue for admin approval, do not touch stock yet
        const [ins] = await c.execute(
          "INSERT INTO stock_adjustments (product_id, quantity, reason, status, staff_id) VALUES (?, ?, ?, 'pending_approval', ?)",
          [data.id, diff, data.reason, u.user_id],
        );
        const adjId = (ins as { insertId: number }).insertId;
        await logAction(null, "REQUEST_STOCK_ADJUSTMENT", "stock_adjustment", adjId, null, {
          product_id: data.id,
          product_name: oldRows[0].name,
          quantity: diff,
          reason: data.reason,
          status: "pending_approval",
        });
        return {
          ok: true,
          pendingApproval: true,
          message: `Stock adjustment of ${absQty} units exceeds the staff limit of ${stockLimit} units and has been submitted for administrator approval.`,
        };
      }

      if (diff === 0) {
        return { ok: true, stock: oldStock };
      }

      // changeStock() runs inside a transaction with a FOR UPDATE lock
      await c.beginTransaction();
      try {
        const newStock = await changeStock(
          c,
          data.id,
          diff,
          data.reason,
          "manual",
          u.user_id,
          u.user_id,
        );
        await c.commit();
        await logAction(
          null,
          "UPDATE_PRODUCT_STOCK",
          "product",
          data.id,
          { stock: oldStock },
          { stock: newStock, reason: data.reason },
        );
        return { ok: true, stock: newStock };
      } catch (e) {
        await c.rollback().catch(() => {});
        throw e;
      }
    });
  });

export const getStockAdjustments = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("inventory.view");
  return withDb((c) =>
    rows<StockAdjustment>(
      c,
      `SELECT sa.id, sa.product_id, p.name product_name, sa.quantity, sa.reason, sa.status, sa.staff_id, u.name staff_name, sa.reviewed_by, sa.reviewed_at, DATE(sa.created_at) created_at
       FROM stock_adjustments sa
       JOIN products p ON p.product_id = sa.product_id
       JOIN users u ON u.user_id = sa.staff_id
       ORDER BY sa.id DESC LIMIT 100`,
    ),
  );
});

export const approveStockAdjustment = createServerFn({ method: "POST" })
  .validator((d) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    return withDb(async (c) => {
      await c.beginTransaction();
      try {
        const [adj] = await rows<StockAdjustment>(
          c,
          "SELECT * FROM stock_adjustments WHERE id=? FOR UPDATE",
          [data.id],
        );
        if (!adj) throw new Error("Adjustment not found.");
        if (adj.status !== "pending_approval") throw new Error("Adjustment already reviewed.");

        const [prod] = await rows<{ stock: number }>(
          c,
          "SELECT stock FROM products WHERE product_id=? FOR UPDATE",
          [adj.product_id],
        );
        if (!prod) throw new Error("Product not found.");

        // changeStock() re-locks under FOR UPDATE and throws if the result
        // would go negative — no silent Math.max(0, …) floor.
        await changeStock(
          c,
          adj.product_id,
          adj.quantity, // signed: positive = restock, negative = write-down
          `Stock adjustment #${data.id} approved`,
          "manual",
          data.id,
          admin.user_id,
        );
        await c.execute(
          "UPDATE stock_adjustments SET status='approved', reviewed_by=?, reviewed_at=NOW() WHERE id=?",
          [admin.user_id, data.id],
        );
        await c.commit();

        await notify(
          adj.staff_id,
          "stock_approval",
          "Stock Adjustment Approved",
          `Your stock adjustment request (#${data.id}) for product ID ${adj.product_id} has been approved.`,
          "/admin",
        );
        await logAction(
          null,
          "APPROVE_STOCK_ADJUSTMENT",
          "stock_adjustment",
          data.id,
          { status: "pending_approval" },
          { status: "approved" },
        );
        return { ok: true };
      } catch (e) {
        await c.rollback().catch(() => {});
        throw e;
      }
    });
  });

export const rejectStockAdjustment = createServerFn({ method: "POST" })
  .validator((d) => z.object({ id: z.number().int(), reason: z.string().optional() }).parse(d))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    return withDb(async (c) => {
      const [adj] = await rows<StockAdjustment>(c, "SELECT * FROM stock_adjustments WHERE id=?", [
        data.id,
      ]);
      if (!adj) throw new Error("Adjustment not found.");
      if (adj.status !== "pending_approval") throw new Error("Adjustment already reviewed.");

      await c.execute(
        "UPDATE stock_adjustments SET status='rejected', reviewed_by=?, reviewed_at=NOW() WHERE id=?",
        [admin.user_id, data.id],
      );
      await notify(
        adj.staff_id,
        "stock_rejection",
        "Stock Adjustment Rejected",
        `Your stock adjustment request (#${data.id}) was rejected.${data.reason ? ` Reason: ${data.reason}` : ""}`,
        "/admin",
      );
      await logAction(
        null,
        "REJECT_STOCK_ADJUSTMENT",
        "stock_adjustment",
        data.id,
        { status: "pending_approval" },
        { status: "rejected" },
      );
      return { ok: true };
    });
  });

export const getAuditLogs = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        actor: z.string().optional(),
        action: z.string().optional(),
        entityType: z.string().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    await requirePermission("audit.view");
    return withDb(async (c) => {
      const where: string[] = [];
      const params: unknown[] = [];
      if (data.startDate) {
        where.push("DATE(created_at) >= ?");
        params.push(data.startDate);
      }
      if (data.endDate) {
        where.push("DATE(created_at) <= ?");
        params.push(data.endDate);
      }
      if (data.actor) {
        where.push("actor_name LIKE ?");
        params.push(`%${data.actor}%`);
      }
      if (data.action) {
        where.push("action = ?");
        params.push(data.action);
      }
      if (data.entityType) {
        where.push("entity_type = ?");
        params.push(data.entityType);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const offset = (data.page - 1) * data.limit;
      const [cnt] = await rows<{ total: number }>(
        c,
        `SELECT COUNT(*) total FROM audit_logs ${whereSql}`,
        params,
      );
      const logs = await rows<{
        id: number;
        actor_id: number | null;
        actor_name: string | null;
        ip_address: string | null;
        action: string;
        entity_type: string;
        entity_id: string;
        old_values: string | null;
        new_values: string | null;
        created_at: string;
      }>(
        c,
        `SELECT id, actor_id, actor_name, ip_address, action, entity_type, entity_id,
                CAST(old_values AS CHAR) old_values, CAST(new_values AS CHAR) new_values, created_at
         FROM audit_logs ${whereSql} ORDER BY id DESC LIMIT ${data.limit} OFFSET ${offset}`,
        params,
      );
      return { logs, total: Number(cnt?.total ?? 0), page: data.page, limit: data.limit };
    });
  });

// ---------- contact form (public) ----------
export const submitContactMessage = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        name: z.string().trim().min(1).max(100),
        email: z.string().trim().email().max(255),
        phone: z.string().trim().max(30).optional(),
        subject: z.string().trim().min(1).max(150),
        message: z.string().trim().min(1).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const id = await withDb(async (c) => {
      const [r] = await c.execute(
        "INSERT INTO contact_messages (name,email,phone,subject,message) VALUES (?,?,?,?,?)",
        [data.name, data.email.toLowerCase(), data.phone || null, data.subject, data.message],
      );
      return (r as { insertId: number }).insertId;
    });

    // Alert everyone who can read messages (admin + staff), in-app and by email.
    const recipients = await withDb((c) =>
      rows<{ user_id: number }>(
        c,
        "SELECT user_id FROM users WHERE role IN ('admin','staff') AND COALESCE(is_active,1)=1",
      ),
    );
    for (const r of recipients) {
      await notify(
        r.user_id,
        "customer_message",
        "New Contact Message",
        `From ${data.name} (${data.email}): ${data.subject}`,
        "/admin",
      );
    }

    await logAction(null, "SUBMIT_CONTACT_MESSAGE", "contact_message", id, null, data);
    return { ok: true, id };
  });

export const getContactMessages = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("messages.view");
  return withDb((c) =>
    rows<ContactMessage>(
      c,
      "SELECT id, name, email, phone, subject, message, is_read, is_archived, DATE(created_at) created_at FROM contact_messages ORDER BY id DESC LIMIT 100",
    ),
  );
});

export const replyContactMessage = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        message_id: z.number().int().optional(),
        quote_id: z.number().int().optional(),
        email: z.string().email(),
        message: z.string().min(1),
        is_internal: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requirePermission("messages.reply");
    const isInternal = Boolean(data.is_internal);
    await withDb(async (c) => {
      if (data.message_id) {
        const cleanText = sanitizeMessage(data.message);
        await c.execute(
          `INSERT INTO contact_message_replies (message_id, staff_id, staff_name, reply_text, is_internal)
           VALUES (?, ?, ?, ?, ?)`,
          [data.message_id, u.user_id, u.name, cleanText, isInternal ? 1 : 0],
        );
        if (!isInternal) {
          await c.execute(
            "INSERT INTO message_replies (message_id, sender_id, reply_text) VALUES (?, ?, ?)",
            [data.message_id, u.user_id, data.message],
          );
        }
      }

      // Only notify & email the customer if this is NOT an internal note
      if (!isInternal) {
        const [target] = await rows<{ user_id: number }>(
          c,
          "SELECT user_id FROM users WHERE email=?",
          [data.email.toLowerCase()],
        );
        if (target) {
          await notify(
            target.user_id,
            "message_reply",
            "New Message from Polar Fiber Support",
            data.message,
            "/contact",
          );
        }

        // For non-registered customers: save reply and email a secure conversation link
        if (data.message_id) {
          const cleanText = sanitizeMessage(data.message);
          const conversationToken = await createConversationToken(
            "contact_message",
            data.message_id,
            data.email,
          );
          const conversationUrl = `https://polarfiber.com.et/conversation/${conversationToken}`;
          const expiresInDays = CONVERSATION_TOKEN_VALID_DAYS;

          await import("./email").then((emailMod) =>
            emailMod.sendConversationNotificationEmail({
              to: data.email,
              subject: "New Reply from Polar Fiber Support",
              text:
                `Hello,\n\nYou received a reply from our support team.\n\n` +
                `Reply: ${data.message}\n\n` +
                `You can view and respond to this conversation securely via:\n${conversationUrl}\n\n` +
                `This link expires in ${expiresInDays} days.\n\n` +
                `Thank you for choosing Polar Fiber!`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #0ea5e9;">New Support Reply</h2>
                  <p>You received a reply from our support team.</p>
                  <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 15px 0;">
                    <p style="margin: 0;"><strong>Reply:</strong></p>
                    <p style="margin: 5px 0 0 0;">${cleanText.replace(/\n/g, "<br/>")}</p>
                  </div>
                  <p>To view this conversation and reply, use your secure link below (expires in ${expiresInDays} days):</p>
                  <p style="margin: 15px 0;"><a href="${conversationUrl}" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Conversation</a></p>
                  <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;" />
                  <p style="color: #64748b; font-size: 14px;">Thank you for choosing Polar Fiber!</p>
                </div>`,
              conversationUrl,
              expiresInDays,
              ctx: { conversationType: "contact_message", conversationId: data.message_id as number },
            }),
          );
        }
      }

      await logAction(
        null,
        isInternal ? "INTERNAL_NOTE_MESSAGE" : "REPLY_MESSAGE",
        "message",
        data.message_id ?? data.quote_id ?? data.email,
        null,
        {
          email: data.email,
          message: data.message,
          is_internal: isInternal,
        },
      );
    });
    return { ok: true };
  });

export const archiveContactMessage = createServerFn({ method: "POST" })
  .validator((d) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission("messages.archive");
    return withDb(async (c) => {
      await c.execute("UPDATE contact_messages SET is_archived=1 WHERE id=?", [data.id]);
      await logAction(null, "ARCHIVE_MESSAGE", "message", data.id, null, { is_archived: 1 });
      return { ok: true };
    });
  });

export const deleteContactMessage = createServerFn({ method: "POST" })
  .validator((d) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission("messages.delete"); // Staff will get 403!
    return withDb(async (c) => {
      await c.execute("DELETE FROM contact_messages WHERE id=?", [data.id]);
      await logAction(null, "DELETE_MESSAGE", "message", data.id, null, null);
      return { ok: true };
    });
  });

export const getSupportTickets = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("support.view");
  return withDb((c) =>
    rows<SupportTicket>(
      c,
      `SELECT st.id, st.ticket_code, st.customer_name, st.customer_email, st.subject, st.category, st.priority, st.status, st.assigned_to, u.name assigned_name, st.internal_notes, DATE(st.created_at) created_at, DATE(st.updated_at) updated_at
       FROM support_tickets st
       LEFT JOIN users u ON u.user_id = st.assigned_to
       ORDER BY st.id DESC LIMIT 100`,
    ),
  );
});

export const assignSupportTicket = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        ticket_id: z.number().int(),
        assigned_to: z.number().int(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requirePermission("support.update_status");
    return withDb(async (c) => {
      const [ticket] = await rows<{ id: number; assigned_to: number | null }>(
        c,
        "SELECT id, assigned_to FROM support_tickets WHERE id=?",
        [data.ticket_id],
      );
      if (!ticket) throw new Error("Support ticket not found.");

      if (u.role === "staff") {
        // Staff cannot reassign a ticket already assigned to another staff member
        if (ticket.assigned_to && ticket.assigned_to !== u.user_id) {
          const err = new Error(
            "Cannot reassign a support ticket already assigned to another staff member.",
          );
          (err as any).statusCode = 403;
          throw err;
        }
        // Staff can only assign to themselves
        if (data.assigned_to !== u.user_id) {
          const err = new Error("Staff members can only assign support tickets to themselves.");
          (err as any).statusCode = 403;
          throw err;
        }
      }

      await c.execute("UPDATE support_tickets SET assigned_to=? WHERE id=?", [
        data.assigned_to,
        data.ticket_id,
      ]);
      await logAction(
        null,
        "ASSIGN_SUPPORT_TICKET",
        "support_ticket",
        data.ticket_id,
        { assigned_to: ticket.assigned_to },
        { assigned_to: data.assigned_to },
      );
      return { ok: true };
    });
  });

export const updateSupportTicketStatus = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        ticket_id: z.number().int(),
        status: z.enum(["Open", "In Progress", "Resolved", "Closed"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission("support.update_status");
    return withDb(async (c) => {
      const [ticket] = await rows<{
        id: number;
        status: string;
        customer_email: string;
        user_id: number | null;
      }>(c, "SELECT id, status, customer_email, user_id FROM support_tickets WHERE id=?", [
        data.ticket_id,
      ]);
      if (!ticket) throw new Error("Support ticket not found.");

      await c.execute("UPDATE support_tickets SET status=? WHERE id=?", [
        data.status,
        data.ticket_id,
      ]);
      if (ticket.user_id) {
        await notify(
          ticket.user_id,
          "ticket_status",
          `Ticket #${data.ticket_id} Status Updated`,
          `Your support ticket status has been updated to "${data.status}".`,
          "/contact",
        );
      }
      await logAction(
        null,
        "UPDATE_TICKET_STATUS",
        "support_ticket",
        data.ticket_id,
        { status: ticket.status },
        { status: data.status },
      );
      return { ok: true };
    });
  });

export const replySupportTicket = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        ticket_id: z.string(),
        user_id: z.number().int().optional(),
        customer_email: z.string().email().optional(),
        reply: z.string().min(1),
        is_internal: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requirePermission("support.reply");
    await withDb(async (c) => {
      const tId = Number(data.ticket_id);
      if (!Number.isNaN(tId) && tId > 0) {
        await c.execute(
          "INSERT INTO ticket_replies (ticket_id, user_id, message, is_internal) VALUES (?, ?, ?, ?)",
          [tId, u.user_id, data.reply, data.is_internal ? 1 : 0],
        );
      }
      // Only notify customer for public replies
      if (!data.is_internal) {
        let targetUserId = data.user_id;
        if (!targetUserId && data.customer_email) {
          const [target] = await rows<{ user_id: number }>(
            c,
            "SELECT user_id FROM users WHERE email=?",
            [data.customer_email.toLowerCase()],
          );
          if (target) targetUserId = target.user_id;
        }
        if (targetUserId) {
          await notify(
            targetUserId,
            "ticket_reply",
            `Reply on Ticket #${data.ticket_id}`,
            data.reply,
            "/contact",
          );
        }
      }
      await logAction(null, "REPLY_SUPPORT_TICKET", "ticket", data.ticket_id, null, {
        reply: data.reply,
        is_internal: data.is_internal,
      });
    });
    return { ok: true };
  });

export const getCompanySettings = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("settings.view");
  return withDb((c) =>
    rows<{ setting_key: string; setting_value: string; description: string | null }>(
      c,
      "SELECT setting_key, setting_value, description FROM app_settings",
    ),
  );
});

export const updateCompanySetting = createServerFn({ method: "POST" })
  .validator((d) => z.object({ key: z.string(), value: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(); // Staff gets 403!
    return withDb(async (c) => {
      let valueToStore = data.value;
      if (data.key === "smtp_password") {
        valueToStore = encryptSmtpPassword(data.value);
      }
      await c.execute(
        "INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=?",
        [data.key, valueToStore, valueToStore],
      );
      await logAction(null, "UPDATE_SETTING", "setting", data.key, null, {
        value: data.key === "smtp_password" ? "[ENCRYPTED]" : data.value,
      });
      return { ok: true };
    });
  });

export const changePassword = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    return withDb(async (c) => {
      const [dbUser] = await rows<{ password_hash: string }>(
        c,
        "SELECT password_hash FROM users WHERE user_id=?",
        [user.user_id],
      );
      if (!dbUser) throw new Error("User not found");

      const valid = await bcrypt.compare(data.currentPassword, dbUser.password_hash);
      if (!valid) {
        throw Object.assign(new Error("Current password is incorrect"), { status: 400 });
      }

      const newHash = await bcrypt.hash(data.newPassword, 12);
      await c.execute("UPDATE users SET password_hash=? WHERE user_id=?", [newHash, user.user_id]);

      await logAction(null, "CHANGE_PASSWORD", "user", user.user_id, null, null);
      return { ok: true };
    });
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        userId: z.number().int().positive(),
        role: z.enum(["customer", "admin", "staff"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    return withDb(async (c) => {
      // Safety: an admin cannot change their own role
      if (actor.user_id === data.userId) {
        throw Object.assign(
          new Error("You cannot change your own role. Ask another administrator."),
          { status: 403 },
        );
      }

      const [targetUser] = await rows<{ user_id: number; name: string }>(
        c,
        "SELECT user_id, name FROM users WHERE user_id=?",
        [data.userId],
      );
      if (!targetUser) throw new Error("User not found.");

      const [currentRole] = await rows<{ role: string }>(
        c,
        "SELECT role FROM user_roles WHERE user_id=?",
        [data.userId],
      );
      const oldRole = currentRole?.role ?? "customer";

      // Safety: prevent removing the last active admin
      if (oldRole === "admin" && data.role !== "admin") {
        const [adminCount] = await rows<{ count: number }>(
          c,
          "SELECT COUNT(*) as count FROM user_roles ur JOIN users u ON u.user_id = ur.user_id WHERE ur.role='admin' AND u.is_active=1",
        );
        if ((adminCount?.count ?? 0) <= 1) {
          throw Object.assign(
            new Error("Cannot demote the last active administrator. Promote another user first."),
            { status: 403 },
          );
        }
      }

      await c.execute("DELETE FROM user_roles WHERE user_id=?", [data.userId]);
      await c.execute("INSERT INTO user_roles (user_id, role) VALUES (?, ?)", [
        data.userId,
        data.role,
      ]);
      // Keep the denormalised role column in sync
      await c.execute("UPDATE users SET role=? WHERE user_id=?", [data.role, data.userId]);

      await notify(
        data.userId,
        "role_change",
        "Account Role Updated",
        `Your Polar Fiber account role has been changed to "${data.role}".`,
        "/admin",
      );

      await logAction(
        null,
        "UPDATE_USER_ROLE",
        "user",
        data.userId,
        { role: oldRole },
        { role: data.role },
      );

      return { ok: true, user_id: data.userId, role: data.role };
    });
  });

export const createTeamMember = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        name: z.string().trim().min(1, "Name is required").max(100),
        email: z.string().trim().email("Valid email required").max(255),
        phone: z.string().trim().max(20).default(""),
        temporaryPassword: z
          .string()
          .min(6, "Temporary password must be at least 6 characters")
          .max(200),
        role: z.enum(["staff", "admin"]).default("staff"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    return withDb(async (c) => {
      const email = data.email.toLowerCase();
      const existing = await rows<{ user_id: number }>(
        c,
        "SELECT user_id FROM users WHERE email=?",
        [email],
      );
      if (existing.length > 0) throw new Error("A user with this email already exists.");

      const hash = await bcrypt.hash(data.temporaryPassword, 12);
      const [res] = await c.execute(
        "INSERT INTO users (name, email, phone, password_hash, role, must_change_password, is_active) VALUES (?, ?, ?, ?, ?, 1, 1)",
        [data.name, email, data.phone, hash, data.role],
      );
      const newUserId = (res as { insertId: number }).insertId;

      await c.execute(
        "INSERT INTO user_roles (user_id, role) VALUES (?, ?) ON DUPLICATE KEY UPDATE role=?",
        [newUserId, data.role, data.role],
      );

      await notify(
        newUserId,
        "welcome",
        "Staff Account Created",
        "Welcome to the team! Your staff account has been created with a temporary password. Please log in and change your password.",
        "/admin",
      );

      await logAction(null, "CREATE_TEAM_MEMBER", "user", newUserId, null, {
        name: data.name,
        email,
        role: data.role,
        must_change_password: true,
      });

      return {
        ok: true,
        user: {
          user_id: newUserId,
          name: data.name,
          email,
          phone: data.phone,
          role: data.role,
          must_change_password: true,
        },
      };
    });
  });

export const getUserPermissions = createServerFn({ method: "GET" }).handler(async () => {
  const u = await currentUser();
  if (!u || u.must_change_password) {
    return {
      role: u?.role ?? ("customer" as Role),
      permissions: [] as string[],
    };
  }
  return {
    role: u.role,
    permissions: getPermissionsForRole(u.role),
  };
});

export const logExportAction = createServerFn({ method: "POST" })
  .validator((d) => z.object({ count: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const u = await requirePermission("reports.export");
    await logAction(null, "EXPORT_ORDERS_CSV", "orders", "csv", null, {
      exported_by: u.name,
      count: data.count,
    });
    return { ok: true };
  });

// =============================================================================
// ADMIN CONSOLE — Phase 3 additions
// =============================================================================

// ─── Categories CRUD ────────────────────────────────────────────────────────

export const getCategories = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("categories.view");
  return withDb((c) =>
    rows<{
      category_id: number;
      name: string;
      slug: string;
      description: string | null;
      parent_id: number | null;
      parent_name: string | null;
      sort_order: number;
      is_active: number;
      product_count: number;
      created_at: string;
    }>(
      c,
      `SELECT c.category_id, c.name, c.slug, c.description,
              c.parent_id, p.name parent_name, COALESCE(c.sort_order,0) sort_order,
              COALESCE(c.is_active,1) is_active,
              (SELECT COUNT(*) FROM products pr
               WHERE pr.category_id = c.category_id
                 AND pr.deleted_at IS NULL) product_count,
              DATE(c.created_at) created_at
       FROM categories c
       LEFT JOIN categories p ON p.category_id = c.parent_id
       ORDER BY c.sort_order ASC, c.name ASC`,
    ),
  );
});

export const saveCategory = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        category_id: z.number().int().min(0),
        name: z.string().trim().min(1).max(100),
        slug: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
        description: z.string().trim().max(500).nullable().optional(),
        parent_id: z.number().int().nullable().optional(),
        sort_order: z.number().int().min(0).max(9999).default(0),
        is_active: z.boolean().optional().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    return withDb(async (c) => {
      if (data.category_id === 0) {
        const nameDup = await rows(c, "SELECT 1 FROM categories WHERE name=?", [data.name]);
        if (nameDup.length) throw new Error("A category with this name already exists.");
        const slugDup = await rows(c, "SELECT 1 FROM categories WHERE slug=?", [data.slug]);
        if (slugDup.length) throw new Error("A category with this slug already exists.");
        const [r] = await c.execute(
          "INSERT INTO categories (name, slug, description, parent_id, sort_order, is_active) VALUES (?,?,?,?,?,?)",
          [data.name, data.slug, data.description ?? null, data.parent_id ?? null, data.sort_order, data.is_active ? 1 : 0],
        );
        const id = (r as { insertId: number }).insertId;
        await logAction(null, "CREATE_CATEGORY", "category", id, null, data);
        return { ok: true, category_id: id };
      } else {
        const [old] = await rows<{ name: string; slug: string; is_active: number }>(
          c,
          "SELECT name, slug, is_active FROM categories WHERE category_id=?",
          [data.category_id],
        );
        if (!old) throw new Error("Category not found.");
        if (old.name !== data.name) {
          const dup = await rows(c, "SELECT 1 FROM categories WHERE name=? AND category_id!=?", [
            data.name,
            data.category_id,
          ]);
          if (dup.length) throw new Error("A category with this name already exists.");
        }
        if (old.slug !== data.slug) {
          const dup = await rows(c, "SELECT 1 FROM categories WHERE slug=? AND category_id!=?", [
            data.slug,
            data.category_id,
          ]);
          if (dup.length) throw new Error("A category with this slug already exists.");
        }
        await c.execute(
          "UPDATE categories SET name=?, slug=?, description=?, parent_id=?, sort_order=?, is_active=? WHERE category_id=?",
          [
            data.name,
            data.slug,
            data.description ?? null,
            data.parent_id ?? null,
            data.sort_order,
            data.is_active ? 1 : 0,
            data.category_id,
          ],
        );
        await logAction(null, "UPDATE_CATEGORY", "category", data.category_id, old, data);
        return { ok: true, category_id: data.category_id };
      }
    });
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .validator((d) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    return withDb(async (c) => {
      const [cnt] = await rows<{ count: number }>(
        c,
        "SELECT COUNT(*) count FROM products WHERE category_id=? AND deleted_at IS NULL",
        [data.id],
      );
      if ((cnt?.count ?? 0) > 0)
        throw new Error(
          "Cannot delete a category that has active products. Reassign or archive them first.",
        );
      const [old] = await rows(c, "SELECT name FROM categories WHERE category_id=?", [data.id]);
      await c.execute("DELETE FROM categories WHERE category_id=?", [data.id]);
      await logAction(null, "DELETE_CATEGORY", "category", data.id, old, null);
      return { ok: true };
    });
  });

export const reorderCategories = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        items: z
          .array(z.object({ category_id: z.number().int(), sort_order: z.number().int() }))
          .min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    return withDb(async (c) => {
      for (const item of data.items) {
        await c.execute("UPDATE categories SET sort_order=? WHERE category_id=?", [
          item.sort_order,
          item.category_id,
        ]);
      }
      return { ok: true };
    });
  });

// ─── Inventory: stock movement history ───────────────────────────────────────

export const getStockMovements = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        product_id: z.number().int(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission("inventory.view");
    return withDb(async (c) => {
      const offset = (data.page - 1) * data.limit;
      const [cnt] = await rows<{ total: number }>(
        c,
        "SELECT COUNT(*) total FROM stock_movements WHERE product_id=?",
        [data.product_id],
      );
      const movements = await rows<{
        id: number;
        product_id: number;
        product_name: string;
        quantity: number;
        type: string;
        reference_type: string;
        reference_id: string;
        note: string | null;
        created_at: string;
      }>(
        c,
        `SELECT sm.id, sm.product_id, p.name product_name, sm.quantity, sm.type,
                sm.reference_type, CAST(sm.reference_id AS CHAR) reference_id,
                sm.note, sm.created_at
         FROM stock_movements sm
         JOIN products p ON p.product_id = sm.product_id
         WHERE sm.product_id=?
         ORDER BY sm.id DESC
         LIMIT ${data.limit} OFFSET ${offset}`,
        [data.product_id],
      );
      return { movements, total: Number(cnt?.total ?? 0), page: data.page, limit: data.limit };
    });
  });

// ─── Quotes: expire overdue ───────────────────────────────────────────────────

export const expireQuotes = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  return withDb(async (c) => {
    const [r] = await c.execute(
      `UPDATE quote_requests
       SET status='Closed'
       WHERE valid_until IS NOT NULL
         AND valid_until < CURDATE()
         AND status NOT IN ('Closed', 'Cancelled')`,
    );
    const affected = (r as { affectedRows: number }).affectedRows;
    await logAction(null, "EXPIRE_QUOTES", "quote", "batch", null, { expired: affected });
    return { ok: true, expired: affected };
  });
});

// ─── Orders: mark paid ────────────────────────────────────────────────────────

export const markOrderPaid = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        order_id: z.number().int(),
        payment_method: z.string().trim().min(1).max(80),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requirePermission("orders.mark_paid");
    return withDb(async (c) => {
      const [order] = await rows<{
        order_id: number;
        status: string;
        user_id: number | null;
        is_paid: number;
      }>(c, "SELECT order_id, status, user_id, is_paid FROM orders WHERE order_id=?", [
        data.order_id,
      ]);
      if (!order) throw new Error("Order not found.");
      if (order.is_paid) throw new Error("Order is already marked as paid.");

      await c.execute(
        "UPDATE orders SET is_paid=1, payment_method=?, payment_status='paid' WHERE order_id=?",
        [data.payment_method, data.order_id],
      );
      await c.execute(
        "INSERT INTO order_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)",
        [data.order_id, order.status, `Marked as paid — method: ${data.payment_method}`, u.user_id],
      );
      await notify(
        order.user_id,
        "order_paid",
        `Order #${data.order_id} Payment Confirmed`,
        `Your payment for Order #${data.order_id} has been confirmed.`,
        "/track-order",
      );
      await logAction(
        null,
        "MARK_ORDER_PAID",
        "order",
        data.order_id,
        { is_paid: 0 },
        { is_paid: 1, payment_method: data.payment_method },
      );
      return { ok: true };
    });
  });

// ─── Customers: block/unblock, detail, CSV export ────────────────────────────

export const blockCustomer = createServerFn({ method: "POST" })
  .validator((d) => z.object({ user_id: z.number().int(), block: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission("customers.block");
    return withDb(async (c) => {
      const [target] = await rows<{ user_id: number; name: string; is_active: number }>(
        c,
        "SELECT user_id, name, is_active FROM users WHERE user_id=?",
        [data.user_id],
      );
      if (!target) throw new Error("User not found.");
      await c.execute("UPDATE users SET is_active=? WHERE user_id=?", [
        data.block ? 0 : 1,
        data.user_id,
      ]);
      await logAction(
        null,
        data.block ? "BLOCK_CUSTOMER" : "UNBLOCK_CUSTOMER",
        "user",
        data.user_id,
        { is_active: target.is_active },
        { is_active: data.block ? 0 : 1 },
      );
      return { ok: true };
    });
  });

export const getCustomerDetail = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        user_id: z.number().int().optional().nullable(),
        email: z.string().trim().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const actor = await requirePermission("customers.view");
    const isStaff = actor.role === "staff";
    return withDb(async (c) => {
      let u: {
        user_id: number | null;
        name: string;
        email: string;
        phone: string | null;
        role: string;
        is_active: number;
        created_at: string;
        is_guest: boolean;
      } | null = null;

      if (data.user_id) {
        const [usr] = await rows<{
          user_id: number;
          name: string;
          email: string;
          phone: string | null;
          role: string;
          is_active: number;
          created_at: string;
        }>(
          c,
          `SELECT u.user_id, u.name, u.email, COALESCE(u.phone, '') as phone,
                  COALESCE((SELECT r.role FROM user_roles r WHERE r.user_id=u.user_id LIMIT 1), u.role) as role,
                  u.is_active, DATE(u.created_at) as created_at
           FROM users u WHERE u.user_id=?`,
          [data.user_id],
        );
        if (usr) {
          u = { ...usr, is_guest: false };
        }
      }

      if (!u && data.email) {
        const [usr] = await rows<{
          user_id: number;
          name: string;
          email: string;
          phone: string | null;
          role: string;
          is_active: number;
          created_at: string;
        }>(
          c,
          `SELECT u.user_id, u.name, u.email, COALESCE(u.phone, '') as phone,
                  COALESCE((SELECT r.role FROM user_roles r WHERE r.user_id=u.user_id LIMIT 1), u.role) as role,
                  u.is_active, DATE(u.created_at) as created_at
           FROM users u WHERE LOWER(u.email)=LOWER(?)`,
          [data.email],
        );
        if (usr) {
          u = { ...usr, is_guest: false };
        }
      }

      const email = (u?.email || data.email || "").trim().toLowerCase();
      const userId = u?.user_id ?? data.user_id ?? null;

      if (!u) {
        if (!email) throw new Error("Customer identifier required.");
        // Synthesize guest customer details from unified customer aggregator
        const allCusts = await loadUnifiedCustomers(c);
        const match = allCusts.find((x) => x.email.toLowerCase() === email);
        if (!match) throw new Error("Customer record not found.");
        u = {
          user_id: match.user_id,
          name: match.name,
          email: match.email,
          phone: match.phone || null,
          role: "guest",
          is_active: 1,
          created_at: match.created_at,
          is_guest: true,
        };
      }

      // 1. Order History
      const orderWhere = userId
        ? "WHERE (o.user_id=? OR LOWER(oa.email)=?) ORDER BY o.order_id DESC LIMIT 25"
        : "WHERE LOWER(oa.email)=? ORDER BY o.order_id DESC LIMIT 25";
      const orderParams = userId ? [userId, email] : [email];
      const recentOrders = await loadOrders(orderWhere, orderParams);

      const completedOrders = recentOrders.filter((o) => o.status === "Delivered");
      const totalSpent = completedOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

      // 2. Quote History
      const quoteWhere = userId
        ? "WHERE (qr.user_id=? OR LOWER(qr.email)=?) ORDER BY qr.quote_id DESC LIMIT 20"
        : "WHERE LOWER(qr.email)=? ORDER BY qr.quote_id DESC LIMIT 20";
      const quoteParams = userId ? [userId, email] : [email];
      const recentQuotes = await rows<{
        quote_id: number;
        subject: string;
        status: string;
        quoted_amount: number | null;
        created_at: string;
      }>(
        c,
        `SELECT qr.quote_id, qr.subject, qr.status, qr.quoted_amount, DATE(qr.created_at) created_at
         FROM quote_requests qr ${quoteWhere}`,
        quoteParams,
      );

      // 3. Contact Messages
      const recentMessages = await rows<{
        id: number;
        subject: string;
        message: string;
        is_read: number;
        created_at: string;
      }>(
        c,
        `SELECT id, subject, message, is_read, DATE(created_at) created_at
         FROM contact_messages WHERE LOWER(email)=? ORDER BY id DESC LIMIT 20`,
        [email],
      );

      // 4. Support Tickets
      const ticketWhere = userId
        ? "WHERE (st.user_id=? OR LOWER(st.customer_email)=?) ORDER BY st.id DESC LIMIT 20"
        : "WHERE LOWER(st.customer_email)=? ORDER BY st.id DESC LIMIT 20";
      const ticketParams = userId ? [userId, email] : [email];
      const recentTickets = await rows<{
        id: number;
        ticket_code: string;
        subject: string;
        category: string;
        priority: string;
        status: string;
        created_at: string;
      }>(
        c,
        `SELECT id, ticket_code, subject, category, priority, status, DATE(created_at) created_at
         FROM support_tickets st ${ticketWhere}`,
        ticketParams,
      );

      // 5. Order Messages (Communication history on orders)
      const recentOrderMessages =
        recentOrders.length > 0
          ? await rows<{
              id: number;
              order_id: number;
              sender_type: string;
              sender_name: string;
              body: string;
              created_at: string;
            }>(
              c,
              `SELECT id, order_id, sender_type, sender_name, body, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as created_at
               FROM order_messages
               WHERE order_id IN (${recentOrders.map(() => "?").join(",")}) AND kind='message'
               ORDER BY id DESC LIMIT 20`,
              recentOrders.map((o) => o.order_id),
            )
          : [];

      return {
        ...u,
        orders_count: recentOrders.length,
        total_spent: isStaff ? 0 : totalSpent,
        recent_orders: isStaff
          ? recentOrders.map((o) => ({
              ...o,
              total: 0,
              items: o.items.map((it) => ({ ...it, unit_price: 0 })),
            }))
          : recentOrders,
        recent_quotes: recentQuotes.map((q) => ({
          ...q,
          quoted_amount: isStaff ? 0 : q.quoted_amount,
        })),
        recent_messages: recentMessages,
        recent_tickets: recentTickets,
        recent_order_messages: recentOrderMessages,
      };
    });
  });

export const exportCustomersCSV = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requirePermission("customers.export");
  const data = await withDb(async (c) => {
    return loadUnifiedCustomers(c);
  });
  const header = "ID,Name,Email,Phone,Role,Type,Active,Orders Placed,Total Spent (ETB),Joined / First Seen\n";
  const csvRows = data
    .map(
      (r) =>
        `"${r.id}","${(r.name || "").replace(/"/g, '""')}","${r.email}","${r.phone || ""}","${r.role}","${r.is_guest ? "Guest" : "Registered"}",${r.is_active},${r.orders_count},${r.total_spent},"${r.created_at}"`,
    )
    .join("\n");
  await logAction(null, "EXPORT_CUSTOMERS_CSV", "customers", "csv", null, {
    exported_by: actor.name,
    count: data.length,
  });
  return { csv: header + csvRows, count: data.length };
});

// ─── Messages: mark read ──────────────────────────────────────────────────────

export const markMessageRead = createServerFn({ method: "POST" })
  .validator((d) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission("messages.view");
    await withDb((c) => c.execute("UPDATE contact_messages SET is_read=1 WHERE id=?", [data.id]));
    return { ok: true };
  });

// ─── Support: ticket replies + create ticket ──────────────────────────────────

export const getSupportTicketReplies = createServerFn({ method: "POST" })
  .validator((d) => z.object({ ticket_id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission("support.view");
    return withDb((c) =>
      rows<{
        id: number;
        ticket_id: number;
        user_id: number | null;
        sender_name: string | null;
        message: string;
        is_internal: number;
        created_at: string;
      }>(
        c,
        `SELECT tr.id, tr.ticket_id, tr.user_id, u.name sender_name,
                tr.message, tr.is_internal, tr.created_at
         FROM ticket_replies tr
         LEFT JOIN users u ON u.user_id = tr.user_id
         WHERE tr.ticket_id=?
         ORDER BY tr.id ASC`,
        [data.ticket_id],
      ),
    );
  });

export const createSupportTicket = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        customer_name: z.string().trim().min(1).max(100),
        customer_email: z
          .union([
            z.string().trim().email().max(255),
            z.literal(""),
            z.null(),
            z.undefined(),
          ])
          .optional(),
        subject: z.string().trim().min(1).max(200),
        category: z.enum([
          "Technical Specs",
          "Installation",
          "Warranty",
          "Custom Fabrication",
          "General",
          "Billing",
        ]),
        priority: z.enum(["Low", "Normal", "High", "Urgent"]),
        message: z.string().trim().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requirePermission("support.view");
    return withDb(async (c) => {
      const email = (data.customer_email ?? "").trim();
      const [usr] = email
        ? await rows<{ user_id: number }>(c, "SELECT user_id FROM users WHERE email=?", [
            email.toLowerCase(),
          ])
        : [undefined];
      const [r] = await c.execute(
        `INSERT INTO support_tickets
           (ticket_code, user_id, customer_name, customer_email, subject, category, priority, assigned_to)
         VALUES (CONCAT('TCK-', FLOOR(1000 + RAND()*9000)), ?, ?, ?, ?, ?, ?, ?)`,
        [
          usr?.user_id ?? null,
          data.customer_name,
          email,
          data.subject,
          data.category,
          data.priority,
          u.user_id,
        ],
      );
      const ticketId = (r as { insertId: number }).insertId;
      if (data.message && data.message.trim()) {
        await c.execute(
          "INSERT INTO ticket_replies (ticket_id, user_id, message, is_internal) VALUES (?,?,?,0)",
          [ticketId, u.user_id, data.message.trim()],
        );
      }
      await logAction(null, "CREATE_SUPPORT_TICKET", "support_ticket", ticketId, null, data);
      return { ok: true, ticket_id: ticketId };
    });
  });

// ─── Reports ──────────────────────────────────────────────────────────────────

export const getSalesReport = createServerFn({ method: "POST" })
  .validator((d) => z.object({ startDate: z.string().trim(), endDate: z.string().trim() }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission("reports.view");
    return withDb(async (c) => {
      const { startDate: sd, endDate: ed } = data;

      const [summary] = await rows<{
        total_orders: number;
        total_revenue: number;
        delivered_orders: number;
        delivered_revenue: number;
      }>(
        c,
        `SELECT COUNT(*) total_orders,
                COALESCE(SUM(total),0) total_revenue,
                SUM(CASE WHEN status='Delivered' THEN 1 ELSE 0 END) delivered_orders,
                COALESCE(SUM(CASE WHEN status='Delivered' THEN total ELSE 0 END),0) delivered_revenue
         FROM orders WHERE DATE(created_at) BETWEEN ? AND ?`,
        [sd, ed],
      );

      const daily = await rows<{ date: string; orders: number; revenue: number }>(
        c,
        `SELECT DATE(created_at) date, COUNT(*) orders,
                COALESCE(SUM(CASE WHEN status='Delivered' THEN total ELSE 0 END),0) revenue
         FROM orders WHERE DATE(created_at) BETWEEN ? AND ?
         GROUP BY DATE(created_at) ORDER BY date ASC`,
        [sd, ed],
      );

      const top_products = await rows<{ product_name: string; qty: number; revenue: number }>(
        c,
        `SELECT oi.product_name, SUM(oi.quantity) qty, SUM(oi.quantity * oi.unit_price) revenue
         FROM order_items oi
         JOIN orders o ON o.order_id = oi.order_id
         WHERE o.status='Delivered' AND DATE(o.created_at) BETWEEN ? AND ?
         GROUP BY oi.product_name ORDER BY revenue DESC LIMIT 10`,
        [sd, ed],
      );

      const by_status = await rows<{ status: string; count: number; revenue: number }>(
        c,
        `SELECT status, COUNT(*) count, COALESCE(SUM(total),0) revenue
         FROM orders WHERE DATE(created_at) BETWEEN ? AND ?
         GROUP BY status`,
        [sd, ed],
      );

      const by_category = await rows<{ category: string; revenue: number; count: number }>(
        c,
        `SELECT c.name category, COALESCE(SUM(oi.quantity * oi.unit_price),0) revenue, COUNT(DISTINCT o.order_id) count
         FROM order_items oi
         JOIN orders o ON o.order_id = oi.order_id
         JOIN products pr ON pr.product_id = oi.product_id
         JOIN categories c ON c.category_id = pr.category_id
         WHERE o.status='Delivered' AND DATE(o.created_at) BETWEEN ? AND ?
         GROUP BY c.category_id ORDER BY revenue DESC`,
        [sd, ed],
      );

      const [quotes] = await rows<{ total: number; accepted: number; converted: number }>(
        c,
        `SELECT COUNT(*) total,
                SUM(CASE WHEN status='Accepted' THEN 1 ELSE 0 END) accepted,
                SUM(CASE WHEN status='Closed' THEN 1 ELSE 0 END) converted
         FROM quote_requests WHERE DATE(created_at) BETWEEN ? AND ?`,
        [sd, ed],
      );

      const [limitRow] = await rows<{ setting_value: string }>(
        c,
        "SELECT setting_value FROM app_settings WHERE setting_key='low_stock_threshold'",
      );
      const threshold = Number(limitRow?.setting_value ?? 5);

      const low_stock = await rows<{
        product_id: number;
        name: string;
        stock: number;
        category: string;
      }>(
        c,
        `SELECT p.product_id, p.name, p.stock, c.name category
         FROM products p JOIN categories c ON c.category_id=p.category_id
         WHERE p.stock <= ? AND p.deleted_at IS NULL
         ORDER BY p.stock ASC`,
        [threshold],
      );

      return { summary, daily, top_products, by_status, by_category, quotes, low_stock };
    });
  });

export const exportReportCSV = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        type: z.enum(["sales", "products", "status", "categories", "quotes", "low_stock"]),
        startDate: z.string().trim(),
        endDate: z.string().trim(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission("reports.export");
    const report = await getSalesReport({
      data: { startDate: data.startDate, endDate: data.endDate },
    } as any);
    let csv = "";
    let filename = "";
    if (data.type === "sales") {
      csv =
        "Date,Orders,Revenue (ETB)\n" +
        (report.daily ?? []).map((r: any) => `"${r.date}",${r.orders},${r.revenue}`).join("\n");
      filename = `sales-report-${data.startDate}-${data.endDate}.csv`;
    } else if (data.type === "products") {
      csv =
        "Product,Qty Sold,Revenue (ETB)\n" +
        (report.top_products ?? [])
          .map((r: any) => `"${r.product_name}",${r.qty},${r.revenue}`)
          .join("\n");
      filename = `top-products-${data.startDate}-${data.endDate}.csv`;
    } else if (data.type === "status") {
      csv =
        "Status,Count,Revenue (ETB)\n" +
        (report.by_status ?? [])
          .map((r: any) => `"${r.status}",${r.count},${r.revenue}`)
          .join("\n");
      filename = `orders-by-status-${data.startDate}-${data.endDate}.csv`;
    } else if (data.type === "categories") {
      csv =
        "Category,Orders,Revenue (ETB)\n" +
        (report.by_category ?? [])
          .map((r: any) => `"${r.category}",${r.count},${r.revenue}`)
          .join("\n");
      filename = `revenue-by-category-${data.startDate}-${data.endDate}.csv`;
    } else if (data.type === "quotes") {
      const q = report.quotes ?? { total: 0, accepted: 0, converted: 0 };
      csv =
        "Metric,Value\nTotal Quotes," +
        q.total +
        "\nAccepted," +
        q.accepted +
        "\nConverted," +
        q.converted;
      filename = `quote-conversion-${data.startDate}-${data.endDate}.csv`;
    } else if (data.type === "low_stock") {
      csv =
        "ID,Name,Stock,Category\n" +
        (report.low_stock ?? [])
          .map((r: any) => `${r.product_id},"${r.name}",${r.stock},"${r.category}"`)
          .join("\n");
      filename = `low-stock-${data.startDate}-${data.endDate}.csv`;
    }
    return { csv, filename };
  });

// ─── Settings: admin profile + team management ────────────────────────────────

export const updateAdminProfile = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        name: z.string().trim().min(1).max(100),
        email: z.string().trim().email().max(255),
        phone: z.string().trim().max(30).optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requirePermission("profile.update");
    return withDb(async (c) => {
      const [old] = await rows<{ name: string; email: string; phone: string }>(
        c,
        "SELECT name, email, phone FROM users WHERE user_id=?",
        [u.user_id],
      );
      if (!old) throw new Error("User not found.");
      if (data.email !== old.email) {
        const dup = await rows(c, "SELECT 1 FROM users WHERE email=? AND user_id!=?", [
          data.email.toLowerCase(),
          u.user_id,
        ]);
        if (dup.length) throw new Error("This email is already in use by another account.");
      }
      await c.execute("UPDATE users SET name=?, email=?, phone=? WHERE user_id=?", [
        data.name,
        data.email.toLowerCase(),
        data.phone,
        u.user_id,
      ]);
      await logAction(null, "UPDATE_ADMIN_PROFILE", "user", u.user_id, old, data);
      return { ok: true };
    });
  });

export const deactivateTeamMember = createServerFn({ method: "POST" })
  .validator((d) => z.object({ user_id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    if (actor.user_id === data.user_id) throw new Error("You cannot deactivate your own account.");
    return withDb(async (c) => {
      const [target] = await rows<{ name: string; role: string; is_active: number }>(
        c,
        "SELECT name, role, is_active FROM users WHERE user_id=?",
        [data.user_id],
      );
      if (!target) throw new Error("User not found.");
      await c.execute("UPDATE users SET is_active=0 WHERE user_id=?", [data.user_id]);
      await logAction(
        null,
        "DEACTIVATE_TEAM_MEMBER",
        "user",
        data.user_id,
        { is_active: target.is_active },
        { is_active: 0 },
      );
      return { ok: true };
    });
  });

export const editTeamMember = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        user_id: z.number().int(),
        name: z.string().trim().min(1).max(100),
        email: z.string().trim().email().max(255),
        phone: z.string().trim().max(30).optional().default(""),
        role: z.enum(["staff", "admin"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    return withDb(async (c) => {
      const [target] = await rows<{ name: string; email: string; phone: string; role: string }>(
        c,
        "SELECT name, email, phone, role FROM users WHERE user_id=?",
        [data.user_id],
      );
      if (!target) throw new Error("User not found.");

      // Guard last admin demotion
      if (target.role === "admin" && data.role !== "admin") {
        const [cnt] = await rows<{ count: number }>(
          c,
          "SELECT COUNT(*) count FROM user_roles ur JOIN users u ON u.user_id=ur.user_id WHERE ur.role='admin' AND u.is_active=1",
        );
        if ((cnt?.count ?? 0) <= 1) throw new Error("Cannot demote the last active administrator.");
      }

      if (data.email.toLowerCase() !== target.email) {
        const dup = await rows(c, "SELECT 1 FROM users WHERE email=? AND user_id!=?", [
          data.email.toLowerCase(),
          data.user_id,
        ]);
        if (dup.length) throw new Error("This email is already in use.");
      }

      await c.execute("UPDATE users SET name=?, email=?, phone=?, role=? WHERE user_id=?", [
        data.name,
        data.email.toLowerCase(),
        data.phone,
        data.role,
        data.user_id,
      ]);
      await c.execute("DELETE FROM user_roles WHERE user_id=?", [data.user_id]);
      await c.execute("INSERT INTO user_roles (user_id, role) VALUES (?,?)", [
        data.user_id,
        data.role,
      ]);
      await logAction(null, "EDIT_TEAM_MEMBER", "user", data.user_id, target, data);
      return { ok: true };
    });
  });

// ─── Products: soft-delete + images ──────────────────────────────────────────

export const softDeleteProduct = createServerFn({ method: "POST" })
  .validator((d) => z.object({ product_id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const u = await requirePermission("products.delete");
    return withDb(async (c) => {
      const [p] = await rows<{ name: string }>(c, "SELECT name FROM products WHERE product_id=?", [
        data.product_id,
      ]);
      if (!p) throw new Error("Product not found.");
      await c.execute("UPDATE products SET deleted_at=NOW() WHERE product_id=?", [data.product_id]);
      await logAction(
        null,
        "SOFT_DELETE_PRODUCT",
        "product",
        data.product_id,
        { name: p.name },
        { deleted_at: "NOW()" },
      );
      return { ok: true };
    });
  });

export const saveProductImages = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        product_id: z.number().int(),
        images: z
          .array(
            z.object({
              url: z.string().trim().min(1).max(500),
              alt_text: z.string().trim().max(200).optional(),
              sort_order: z.number().int().min(0).default(0),
            }),
          )
          .max(10),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission("products.update");
    return withDb(async (c) => {
      await c.execute("DELETE FROM product_images WHERE product_id=?", [data.product_id]);
      for (const img of data.images) {
        await c.execute(
          "INSERT INTO product_images (product_id, url, alt_text, sort_order) VALUES (?,?,?,?)",
          [data.product_id, img.url, img.alt_text ?? null, img.sort_order],
        );
      }
      return { ok: true, count: data.images.length };
    });
  });

export const getProductImages = createServerFn({ method: "POST" })
  .validator((d) => z.object({ product_id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission("products.view");
    return withDb((c) =>
      rows<{ id: number; url: string; alt_text: string | null; sort_order: number }>(
        c,
        "SELECT id, url, alt_text, sort_order FROM product_images WHERE product_id=? ORDER BY sort_order ASC",
        [data.product_id],
      ),
    );
  });
