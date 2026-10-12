import { createServerFn } from "@tanstack/react-start";
import {
  getCookie,
  deleteCookie,
  getRequestHeader,
  getRequestIP,
} from "@tanstack/react-start/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { withDb, rows } from "./db.server";
import {
  currentUser,
  endSession,
  loadUser,
  requireAdmin,
  requirePermission,
  requireUser,
  startSession,
  issueTokenPair,
  revokeRefreshToken,
  rotateRefreshToken,
} from "./session.server";
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
  withDb((c) => rows<Product>(c, `${PUBLIC_PRODUCT_SQL} ORDER BY p.product_id`)),
);

export const getProduct = createServerFn({ method: "POST" })
  .validator((d) => z.object({ id: z.coerce.number().int() }).parse(d))
  .handler(async ({ data }) =>
    withDb(
      async (c) =>
        (await rows<Product>(c, `${PUBLIC_PRODUCT_SQL} AND p.product_id=?`, [data.id]))[0] ?? null,
    ),
  );

// ---------- product images (served from database BLOBs) ----------
export const getProductImage = createServerFn({ method: "GET" })
  .validator((d) => z.object({ id: z.coerce.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const [rows] = await withDb((c) =>
      c.execute(
        "SELECT image_data, mime_type FROM product_images WHERE product_id = ? AND is_primary = 1 LIMIT 1",
        [data.id],
      ),
    );
    if (!rows[0]) return null;
    return {
      data: rows[0].image_data,
      mimeType: rows[0].mime_type,
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

export const register = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        name: z.string().trim().min(1).max(100),
        email: z.string().trim().email().max(255),
        phone: z.string().trim().max(20),
        password: z
          .string()
          .min(8, "Password must be at least 8 characters")
          .max(200)
          .refine((v) => /[a-zA-Z]/.test(v), "Password must contain at least one letter")
          .refine((v) => /[0-9]/.test(v), "Password must contain at least one number"),
        // role is IGNORED — always forced to 'customer' server-side
        role: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const hash = await bcrypt.hash(data.password, 12);
    const uid = await withDb(async (c) => {
      const exists = await rows(c, "SELECT 1 FROM users WHERE email=?", [data.email.toLowerCase()]);
      if (exists.length) return null;
      // Public register ALWAYS forces role='customer' regardless of what the
      // client sent. The role field in the validator is accepted but silently dropped.
      const [r] = await c.execute(
        "INSERT INTO users (name,email,phone,password_hash,role,must_change_password) VALUES (?,?,?,?,'customer',0)",
        [data.name, data.email.toLowerCase(), data.phone, hash],
      );
      const id = (r as { insertId: number }).insertId;
      await c.execute(
        "INSERT INTO user_roles (user_id,role) VALUES (?, 'customer') ON DUPLICATE KEY UPDATE role='customer'",
        [id],
      );
      return id;
    });
    if (!uid) return { error: "An account with this email already exists." };
    startSession(uid);
    await issueTokenPair(uid, getUserAgent());
    return { user: await loadUser(uid) };
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

export const forgotPassword = createServerFn({ method: "POST" })
  .validator((d) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data }) => {
    const found = await withDb((c) =>
      rows<{ user_id: number }>(c, "SELECT user_id FROM users WHERE email=?", [
        data.email.toLowerCase(),
      ]),
    );
    const userRecord = found[0];
    if (userRecord) {
      const plainToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(plainToken).digest("hex");
      await withDb((c) =>
        c.execute(
          "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))",
          [userRecord.user_id, tokenHash],
        ),
      );
      // TODO: send plainToken via email transport.
      // The token is intentionally NOT logged — logging it would be a security
      // vulnerability. Wire up an email provider (e.g. nodemailer, Resend) and
      // send the reset link: /reset-password?token=<plainToken>
    }
    return { ok: true };
  });

export const resetPassword = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        token: z.string(),
        password: z
          .string()
          .min(8, "Password must be at least 8 characters")
          .max(200)
          .refine((v) => /[a-zA-Z]/.test(v), "Password must contain at least one letter")
          .refine((v) => /[0-9]/.test(v), "Password must contain at least one number"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const tokenHash = createHash("sha256").update(data.token).digest("hex");
    const found = await withDb((c) =>
      rows<{ id: number; user_id: number }>(
        c,
        "SELECT id,user_id FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at > NOW()",
        [tokenHash],
      ),
    );
    const resetRecord = found[0];
    if (!resetRecord) return { error: "This reset link is invalid or has expired." };

    const newHash = await bcrypt.hash(data.password, 12);
    await withDb(async (c) => {
      await c.execute("UPDATE users SET password_hash=? WHERE user_id=?", [
        newHash,
        resetRecord.user_id,
      ]);
      await c.execute("UPDATE password_reset_tokens SET used_at=NOW() WHERE id=?", [
        resetRecord.id,
      ]);
      await c.execute("DELETE FROM refresh_tokens WHERE user_id=?", [resetRecord.user_id]);
    });
    return { ok: true };
  });

// ---------- orders & quotes ----------
async function loadOrders(where: string, params: unknown[]): Promise<Order[]> {
  return withDb(async (c) => {
    const os = await rows<Omit<Order, "items"> & { customer: string }>(
      c,
      `SELECT o.order_id,o.user_id,o.total,o.status,o.address,o.is_paid,o.payment_method,o.internal_notes,DATE(o.created_at) created_at,u.name customer
       FROM orders o JOIN users u ON u.user_id=o.user_id ${where} ORDER BY o.order_id DESC`,
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
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requireUser();
    return withDb(async (c) => {
      // Sort unique product IDs to guarantee consistent row lock ordering and prevent deadlocks
      const ids = [...new Set(data.items.map((i) => i.product_id))].sort((a, b) => a - b);
      if (!ids.length) throw new Error("Order must contain at least one item.");

      await c.beginTransaction();
      try {
        // Prices always come from the database using SELECT ... FOR UPDATE
        // Stock sufficiency is verified inside changeStock() under its own lock.
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
          u.user_id,
          total,
          data.address,
        ]);
        const oid = (r as { insertId: number }).insertId;

        for (const l of lines) {
          await c.execute(
            "INSERT INTO order_items (order_id,product_id,product_name,quantity,unit_price) VALUES (?,?,?,?,?)",
            [oid, l.product_id, l.p.name, l.quantity, l.p.price],
          );

          // Deduct stock via shared helper (locks row, blocks negative, records movement)
          await changeStock(
            c,
            l.product_id,
            -l.quantity,
            `Order #${oid} placed`,
            "order",
            oid,
            u.user_id,
          );
        }

        await c.commit();
        return { order_id: oid };
      } catch (e) {
        await c.rollback().catch(() => {});
        throw e;
      }
    });
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
    await withDb((c) =>
      c.execute(
        "INSERT INTO quote_requests (user_id,name,email,subject,message) VALUES (?,?,?,?,?)",
        [u?.user_id ?? null, data.name, data.email, data.subject, data.message],
      ),
    );
    return { ok: true };
  });

const QUOTE_SQL =
  "SELECT quote_id,user_id,name,email,phone,subject,message,delivery_location,quoted_amount,valid_until,assigned_to,status,DATE(created_at) created_at FROM quote_requests";

export const getMyAccount = createServerFn({ method: "GET" }).handler(async () => {
  const u = await requireUser();
  const orders = await loadOrders("WHERE o.user_id=?", [u.user_id]);
  const quotes = await withDb((c) =>
    rows<Quote>(c, `${QUOTE_SQL} WHERE user_id=? OR email=? ORDER BY quote_id DESC`, [
      u.user_id,
      u.email,
    ]),
  );
  return { orders, quotes };
});

export const getMyDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const u = await requireUser();
  const recentOrders = await loadOrders("WHERE o.user_id=? LIMIT 5", [u.user_id]);
  return withDb(async (c) => {
    const [orderStats] = await rows<{
      active_orders: number;
      delivered_orders: number;
    }>(
      c,
      `SELECT
        COUNT(CASE WHEN status IN ('Pending', 'Confirmed', 'In Production') THEN 1 END) as active_orders,
        COUNT(CASE WHEN status = 'Delivered' THEN 1 END) as delivered_orders
       FROM orders WHERE user_id=?`,
      [u.user_id],
    );

    const [quoteStats] = await rows<{ open_quotes: number }>(
      c,
      `SELECT COUNT(*) as open_quotes FROM quote_requests WHERE (user_id=? OR email=?) AND status='New'`,
      [u.user_id, u.email],
    );

    return {
      stats: {
        activeOrders: Number(orderStats?.active_orders ?? 0),
        deliveredOrders: Number(orderStats?.delivered_orders ?? 0),
        openQuotes: Number(quoteStats?.open_quotes ?? 0),
      },
      recentOrders,
    };
  });
});

export const getMyOrders = createServerFn({ method: "GET" }).handler(async () => {
  const u = await requireUser();
  return loadOrders("WHERE o.user_id=?", [u.user_id]);
});

export const getMyQuotes = createServerFn({ method: "GET" }).handler(async () => {
  const u = await requireUser();
  return withDb((c) =>
    rows<Quote>(c, `${QUOTE_SQL} WHERE user_id=? OR email=? ORDER BY quote_id DESC`, [
      u.user_id,
      u.email,
    ]),
  );
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        name: z.string().trim().min(1, "Name cannot be empty").max(100),
        phone: z.string().trim().max(20),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requireUser();
    await withDb((c) =>
      c.execute("UPDATE users SET name=?, phone=? WHERE user_id=?", [
        data.name,
        data.phone,
        u.user_id,
      ]),
    );
    const updatedUser = await loadUser(u.user_id);
    return { user: updatedUser };
  });

export const changeMyPassword = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        currentPassword: z.string().min(1, "Current password is required").max(200),
        newPassword: z.string().min(6, "New password must be at least 6 characters").max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requireUser();
    const found = await withDb((c) =>
      rows<{ password_hash: string }>(c, "SELECT password_hash FROM users WHERE user_id=?", [
        u.user_id,
      ]),
    );
    if (!found[0] || !(await bcrypt.compare(data.currentPassword, found[0].password_hash))) {
      throw new Error("Current password does not match.");
    }
    const newHash = await bcrypt.hash(data.newPassword, 12);
    await withDb((c) =>
      c.execute("UPDATE users SET password_hash=?, must_change_password=0 WHERE user_id=?", [
        newHash,
        u.user_id,
      ]),
    );
    await logAction(null, "CHANGE_PASSWORD", "user", u.user_id, null, { updated: true });
    await notify(
      u.user_id,
      "security",
      "Password Changed",
      "Your account password has been updated.",
      u.role === "customer" ? "/account" : "/admin",
    );
    return { ok: true, user: await loadUser(u.user_id) };
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
      u.role === "customer" ? "/account" : "/admin",
    );
    return { ok: true, user: await loadUser(u.user_id) };
  });

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
    const [quoteCount] = await rows<{ count: number }>(
      c,
      "SELECT COUNT(*) as count FROM quote_requests WHERE status = 'New'",
    );
    const [lowStock] = await rows<{ count: number }>(
      c,
      "SELECT COUNT(*) as count FROM products WHERE stock <= 5",
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
        newQuotes: Number(quoteCount?.count ?? 0),
        lowStockCount: Number(lowStock?.count ?? 0),
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
        `SELECT COUNT(*) as total FROM orders o JOIN users u ON u.user_id=o.user_id ${whereSql}`,
        queryParams,
      );
      const total = Number(countResult[0]?.total ?? 0);

      // Fetch matching paginated orders
      const ordersSql = `SELECT o.order_id,o.user_id,o.total,o.status,o.address,o.is_paid,o.payment_method,o.internal_notes,DATE(o.created_at) created_at,u.name customer
        FROM orders o JOIN users u ON u.user_id=o.user_id
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

export const getCustomers = createServerFn({ method: "GET" }).handler(async () => {
  const u = await requirePermission("customers.view");
  const isStaff = u.role === "staff";
  return withDb(async (c) => {
    const list = await rows<{
      user_id: number;
      name: string;
      email: string;
      phone: string;
      role: "customer" | "admin" | "staff";
      orders_count: number;
      total_spent: number;
      created_at: string;
    }>(
      c,
      `SELECT u.user_id, u.name, u.email, u.phone,
              CASE
                WHEN EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.user_id AND r.role='admin') THEN 'admin'
                WHEN EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.user_id AND r.role='staff') THEN 'staff'
                ELSE 'customer'
              END as role,
              (SELECT COUNT(*) FROM orders o WHERE o.user_id=u.user_id) as orders_count,
              COALESCE((SELECT SUM(total) FROM orders o WHERE o.user_id=u.user_id AND o.status != 'Cancelled'), 0) as total_spent,
              DATE(u.created_at) as created_at
       FROM users u
       ORDER BY total_spent DESC, orders_count DESC`,
    );
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
    const u = await requirePermission("products.update");
    let productId = data.product_id;
    await withDb(async (c) => {
      const cat = (
        await rows<{ category_id: number }>(c, "SELECT category_id FROM categories WHERE name=?", [
          data.category as Category,
        ])
      )[0];
      if (!cat) throw new Error("Unknown category.");

      if (data.product_id === 0) {
        if (u.role === "staff") {
          const err = new Error("Staff members are not permitted to create new products.");
          (err as any).statusCode = 403;
          throw err;
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
        const finalSku = (data.sku ?? "").trim() || `PF-${String(productId).padStart(5, "0")}`;
        const baseSlug =
          (data.slug ?? "").trim() ||
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
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requirePermission("orders.update_status");
    await withDb(async (c) => {
      await c.beginTransaction();
      try {
        const [existing] = await rows<{
          order_id: number;
          user_id: number;
          status: OrderStatus;
          is_paid: number;
          payment_method: string;
        }>(
          c,
          "SELECT order_id, user_id, status, is_paid, payment_method FROM orders WHERE order_id=? FOR UPDATE",
          [data.id],
        );
        if (!existing) throw new Error("Order not found.");

        const prevStatus = existing.status;
        const newStatus = data.status as OrderStatus;

        // Staff order progression validation:
        if (u.role === "staff") {
          // Cannot cancel once out for delivery or delivered
          if (
            newStatus === "Cancelled" &&
            (prevStatus === "Out for Delivery" || prevStatus === "Delivered")
          ) {
            const err = new Error(
              "Staff members cannot cancel orders once out for delivery or delivered.",
            );
            (err as any).statusCode = 403;
            throw err;
          }

          // Allowed transitions progression: Pending -> Confirmed -> In Production -> Out for Delivery -> Delivered
          const validTransitions: Record<OrderStatus, OrderStatus[]> = {
            Pending: ["Confirmed", "Cancelled"],
            Confirmed: ["In Production", "Cancelled"],
            "In Production": ["Out for Delivery", "Cancelled"],
            "Out for Delivery": ["Delivered"],
            Delivered: [],
            Cancelled: [],
          };

          const allowed = validTransitions[prevStatus] ?? [];
          if (!allowed.includes(newStatus)) {
            const err = new Error(
              `Invalid order status transition from ${prevStatus} to ${newStatus} for staff members.`,
            );
            (err as any).statusCode = 403;
            throw err;
          }

          // Delivered only allowed if paid or cash_on_delivery
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

        // Insert into order_status_history
        await c.execute(
          "INSERT INTO order_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)",
          [data.id, newStatus, data.notes ?? null, u.user_id],
        );

        await c.commit();

        // Notify customer
        await notify(
          existing.user_id,
          "order_status",
          `Order #${existing.order_id} ${newStatus}`,
          `Your order #${existing.order_id} status has been updated to ${newStatus}.`,
          `/account?tab=orders`,
        );

        // Audit log
        await logAction(
          null,
          "UPDATE_ORDER_STATUS",
          "order",
          data.id,
          { status: prevStatus },
          { status: newStatus, notes: data.notes },
        );
      } catch (err) {
        await c.rollback().catch(() => {});
        throw err;
      }
    });
    return { ok: true };
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
        `/account?tab=quotes`,
      );

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
        "/account?tab=quotes",
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
      if (!["Replied", "Reviewing", "New"].includes(q.status))
        throw new Error("Only active quotes (New/Replied/Reviewing) can be converted to orders.");
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
      if (!userId)
        throw new Error(
          "No user account found for this quote. Ask the customer to register first.",
        );

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

        await c.execute(
          `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
           VALUES (?, NULL, ?, 1, ?)`,
          [orderId, `Quote #${q.quote_id} — ${q.email}`, q.quoted_amount],
        );

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
          "/account?tab=orders",
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

export const getMyNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const u = await requireUser();
  return withDb((c) =>
    rows<{
      id: number;
      user_id: number;
      type: string;
      title: string;
      body: string;
      link_url: string | null;
      is_read: number;
      created_at: string;
    }>(
      c,
      "SELECT id, user_id, type, title, body, link_url, is_read, DATE(created_at) created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50",
      [u.user_id],
    ),
  );
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
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requirePermission("messages.reply");
    await withDb(async (c) => {
      if (data.message_id) {
        await c.execute(
          "INSERT INTO message_replies (message_id, sender_id, reply_text) VALUES (?, ?, ?)",
          [data.message_id, u.user_id, data.message],
        );
      }
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
          "/account?tab=support",
        );
      }
      await logAction(
        null,
        "REPLY_MESSAGE",
        "message",
        data.message_id ?? data.quote_id ?? data.email,
        null,
        {
          email: data.email,
          message: data.message,
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
          "/account?tab=support",
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
            "/account?tab=support",
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
        data.role === "customer" ? "/account" : "/admin",
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
          .min(8, "Temporary password must be at least 8 characters")
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
    const u = await requirePermission("orders.view");
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
      product_count: number;
      created_at: string;
    }>(
      c,
      `SELECT c.category_id, c.name, c.slug, c.description,
              c.parent_id, p.name parent_name, COALESCE(c.sort_order,0) sort_order,
              (SELECT COUNT(*) FROM products pr
               WHERE pr.category_id = c.category_id
                 AND (pr.deleted_at IS NULL OR pr.deleted_at = '0000-00-00 00:00:00')) product_count,
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
          "INSERT INTO categories (name, slug, description, parent_id, sort_order) VALUES (?,?,?,?,?)",
          [data.name, data.slug, data.description ?? null, data.parent_id ?? null, data.sort_order],
        );
        const id = (r as { insertId: number }).insertId;
        await logAction(null, "CREATE_CATEGORY", "category", id, null, data);
        return { ok: true, category_id: id };
      } else {
        const [old] = await rows<{ name: string; slug: string }>(
          c,
          "SELECT name, slug FROM categories WHERE category_id=?",
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
          "UPDATE categories SET name=?, slug=?, description=?, parent_id=?, sort_order=? WHERE category_id=?",
          [
            data.name,
            data.slug,
            data.description ?? null,
            data.parent_id ?? null,
            data.sort_order,
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
        "SELECT COUNT(*) count FROM products WHERE category_id=? AND (deleted_at IS NULL OR deleted_at='0000-00-00 00:00:00')",
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
        user_id: number;
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
        "/account?tab=orders",
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
  .validator((d) => z.object({ user_id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const actor = await requirePermission("customers.view");
    const isStaff = actor.role === "staff";
    return withDb(async (c) => {
      const [u] = await rows<{
        user_id: number;
        name: string;
        email: string;
        phone: string;
        role: string;
        is_active: number;
        created_at: string;
      }>(
        c,
        "SELECT user_id,name,email,phone,role,is_active,DATE(created_at) created_at FROM users WHERE user_id=?",
        [data.user_id],
      );
      if (!u) throw new Error("Customer not found.");
      const [stats] = await rows<{ orders_count: number; total_spent: number }>(
        c,
        `SELECT COUNT(*) orders_count,
                COALESCE(SUM(CASE WHEN status!='Cancelled' THEN total ELSE 0 END),0) total_spent
         FROM orders WHERE user_id=?`,
        [data.user_id],
      );
      const recentOrders = await loadOrders("WHERE o.user_id=? ORDER BY o.order_id DESC LIMIT 10", [
        data.user_id,
      ]);
      return {
        ...u,
        orders_count: Number(stats?.orders_count ?? 0),
        total_spent: isStaff ? 0 : Number(stats?.total_spent ?? 0),
        recent_orders: isStaff
          ? recentOrders.map((o) => ({
              ...o,
              total: 0,
              items: o.items.map((it) => ({ ...it, unit_price: 0 })),
            }))
          : recentOrders,
      };
    });
  });

export const exportCustomersCSV = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await requirePermission("customers.export");
  const data = await withDb((c) =>
    rows<{
      user_id: number;
      name: string;
      email: string;
      phone: string;
      role: string;
      is_active: number;
      orders_count: number;
      total_spent: number;
      created_at: string;
    }>(
      c,
      `SELECT u.user_id, u.name, u.email, COALESCE(u.phone,'') phone,
              COALESCE((SELECT r.role FROM user_roles r WHERE r.user_id=u.user_id LIMIT 1), u.role) role,
              u.is_active,
              (SELECT COUNT(*) FROM orders o WHERE o.user_id=u.user_id) orders_count,
              COALESCE((SELECT SUM(total) FROM orders o WHERE o.user_id=u.user_id AND o.status!='Cancelled'),0) total_spent,
              DATE(u.created_at) created_at
       FROM users u ORDER BY u.user_id`,
    ),
  );
  const header = "ID,Name,Email,Phone,Role,Active,Orders,Total Spent,Joined\n";
  const csvRows = data
    .map(
      (r) =>
        `${r.user_id},"${r.name.replace(/"/g, '""')}","${r.email}","${r.phone}","${r.role}",${r.is_active},${r.orders_count},${r.total_spent},"${r.created_at}"`,
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
        customer_email: z.string().trim().email().max(255),
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
      const [usr] = await rows<{ user_id: number }>(c, "SELECT user_id FROM users WHERE email=?", [
        data.customer_email.toLowerCase(),
      ]);
      const [r] = await c.execute(
        `INSERT INTO support_tickets
           (ticket_code, user_id, customer_name, customer_email, subject, category, priority, assigned_to)
         VALUES (CONCAT('TCK-', FLOOR(1000 + RAND()*9000)), ?, ?, ?, ?, ?, ?, ?)`,
        [
          usr?.user_id ?? null,
          data.customer_name,
          data.customer_email,
          data.subject,
          data.category,
          data.priority,
          u.user_id,
        ],
      );
      const ticketId = (r as { insertId: number }).insertId;
      if (data.message) {
        await c.execute(
          "INSERT INTO ticket_replies (ticket_id, user_id, message, is_internal) VALUES (?,?,?,0)",
          [ticketId, u.user_id, data.message],
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
         WHERE p.stock <= ? AND (p.deleted_at IS NULL OR p.deleted_at='0000-00-00 00:00:00')
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
      const q = report.quotes;
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

// =============================================================================
// CUSTOMER MESSAGES / CONVERSATIONS
// =============================================================================

interface CustomerConversationRow {
  conversation_id: number;
  user_id: number;
  subject: string;
  topic: string;
  status: "Awaiting Reply" | "Admin Replied" | "Resolved";
  created_at: string;
  updated_at: string;
  last_message_text?: string | null;
  last_message_at?: string | null;
  unread_count?: number;
}

interface CustomerMessageRow {
  message_id: number;
  conversation_id: number;
  sender_type: "customer" | "admin";
  sender_id: number;
  sender_name: string;
  text: string;
  is_read: number;
  created_at: string;
}

export const getCustomerConversations = createServerFn({ method: "GET" }).handler(async () => {
  const u = await requireUser();
  return withDb((c) =>
    rows<CustomerConversationRow>(
      c,
      `SELECT cc.conversation_id, cc.user_id, cc.subject, cc.topic, cc.status,
              cc.created_at, cc.updated_at,
              cm.text as last_message_text,
              cm.created_at as last_message_at,
              (SELECT COUNT(*) FROM customer_messages WHERE conversation_id = cc.conversation_id AND sender_type = 'admin' AND is_read = 0) as unread_count
       FROM customer_conversations cc
       LEFT JOIN customer_messages cm ON cm.conversation_id = cc.conversation_id
       WHERE cc.user_id = ?
       ORDER BY cc.updated_at DESC`,
      [u.user_id],
    ),
  );
});

export const getCustomerConversationMessages = createServerFn({ method: "POST" })
  .validator((d) => z.object({ conversation_id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const u = await requireUser();
    return withDb(async (c) => {
      // Verify ownership
      const [conv] = await rows<{ conversation_id: number; user_id: number }>(
        c,
        "SELECT conversation_id, user_id FROM customer_conversations WHERE conversation_id = ?",
        [data.conversation_id],
      );
      if (!conv || conv.user_id !== u.user_id) throw new Error("Conversation not found.");

      // Mark admin messages as read
      await c.execute(
        "UPDATE customer_messages SET is_read = 1 WHERE conversation_id = ? AND sender_type = 'admin'",
        [data.conversation_id],
      );

      return rows<CustomerMessageRow>(
        c,
        "SELECT message_id, conversation_id, sender_type, sender_id, sender_name, text, is_read, created_at FROM customer_messages WHERE conversation_id = ? ORDER BY created_at ASC",
        [data.conversation_id],
      );
    });
  });

export const createCustomerConversation = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        subject: z.string().trim().min(1).max(200),
        topic: z.string().trim().min(1).max(100).default("General Inquiry"),
        text: z.string().trim().min(1).max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requireUser();
    return withDb(async (c) => {
      await c.beginTransaction();
      try {
        const [convResult] = await c.execute(
          "INSERT INTO customer_conversations (user_id, subject, topic, status) VALUES (?, ?, ?, 'Awaiting Reply')",
          [u.user_id, data.subject, data.topic],
        );
        const conversationId = (convResult as { insertId: number }).insertId;

        await c.execute(
          "INSERT INTO customer_messages (conversation_id, sender_type, sender_id, sender_name, text) VALUES (?, 'customer', ?, ?, ?)",
          [conversationId, u.user_id, u.name, data.text],
        );

        // Notify admins
        const admins = await rows<{ user_id: number }>(
          c,
          "SELECT user_id FROM users u JOIN user_roles ur ON ur.user_id = u.user_id WHERE ur.role = 'admin' AND u.is_active = 1",
        );
        for (const admin of admins) {
          await notify(
            admin.user_id,
            "customer_message",
            `New Customer Message: ${data.subject}`,
            `Customer ${u.name} started a new conversation.`,
            `/admin?tab=messages&conversation=${conversationId}`,
          );
        }

        await logAction(null, "CREATE_CUSTOMER_CONVERSATION", "conversation", conversationId, null, {
          user_id: u.user_id,
          subject: data.subject,
          topic: data.topic,
        });

        await c.commit();
        return { ok: true, conversation_id: conversationId };
      } catch (e) {
        await c.rollback().catch(() => {});
        throw e;
      }
    });
  });

export const replyToCustomerConversation = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        conversation_id: z.number().int(),
        text: z.string().trim().min(1).max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requireUser();
    return withDb(async (c) => {
      const [conv] = await rows<{ conversation_id: number; user_id: number; subject: string }>(
        c,
        "SELECT conversation_id, user_id, subject FROM customer_conversations WHERE conversation_id = ?",
        [data.conversation_id],
      );
      if (!conv) throw new Error("Conversation not found.");

      await c.beginTransaction();
      try {
        await c.execute(
          "INSERT INTO customer_messages (conversation_id, sender_type, sender_id, sender_name, text) VALUES (?, ?, ?, ?, ?)",
          [data.conversation_id, u.role === "admin" ? "admin" : "customer", u.user_id, u.name, data.text],
        );

        await c.execute(
          "UPDATE customer_conversations SET status = ?, updated_at = NOW() WHERE conversation_id = ?",
          [u.role === "admin" ? "Admin Replied" : "Awaiting Reply", data.conversation_id],
        );

        // Notify the other party
        const targetUserId = u.role === "admin" ? conv.user_id : null; // Admins will be notified separately
        if (targetUserId) {
          await notify(
            targetUserId,
            "customer_message",
            `Reply on: ${conv.subject}`,
            `You have a new message from ${u.name}.`,
            `/account?tab=messages&conversation=${data.conversation_id}`,
          );
        } else if (u.role === "customer") {
          // Notify all admins
          const admins = await rows<{ user_id: number }>(
            c,
            "SELECT user_id FROM users u JOIN user_roles ur ON ur.user_id = u.user_id WHERE ur.role = 'admin' AND u.is_active = 1",
          );
          for (const admin of admins) {
            await notify(
              admin.user_id,
              "customer_message",
              `Customer Reply: ${conv.subject}`,
              `Customer ${u.name} replied.`,
              `/admin?tab=messages&conversation=${data.conversation_id}`,
            );
          }
        }

        await logAction(null, "REPLY_CUSTOMER_CONVERSATION", "conversation", data.conversation_id, null, {
          sender_type: u.role === "admin" ? "admin" : "customer",
          sender_id: u.user_id,
        });

        await c.commit();
        return { ok: true };
      } catch (e) {
        await c.rollback().catch(() => {});
        throw e;
      }
    });
  });

export const resolveCustomerConversation = createServerFn({ method: "POST" })
  .validator((d) => z.object({ conversation_id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const u = await requireUser();
    if (u.role !== "admin") throw Object.assign(new Error("Only admins can resolve conversations."), { status: 403 });
    return withDb(async (c) => {
      const [conv] = await rows<{ conversation_id: number }>(
        c,
        "SELECT conversation_id FROM customer_conversations WHERE conversation_id = ?",
        [data.conversation_id],
      );
      if (!conv) throw new Error("Conversation not found.");
      await c.execute(
        "UPDATE customer_conversations SET status = 'Resolved', updated_at = NOW() WHERE conversation_id = ?",
        [data.conversation_id],
      );
      await logAction(null, "RESOLVE_CUSTOMER_CONVERSATION", "conversation", data.conversation_id, null, {
        resolved_by: u.user_id,
      });
      return { ok: true };
    });
  });

// Admin: list all customer conversations
export const getAllCustomerConversations = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermission("messages.view");
  return withDb((c) =>
    rows<CustomerConversationRow & { customer_name: string; customer_email: string }>(
      c,
      `SELECT cc.conversation_id, cc.user_id, cc.subject, cc.topic, cc.status,
              cc.created_at, cc.updated_at,
              u.name as customer_name,
              u.email as customer_email,
              cm.text as last_message_text,
              cm.created_at as last_message_at,
              (SELECT COUNT(*) FROM customer_messages WHERE conversation_id = cc.conversation_id AND sender_type = 'customer' AND is_read = 0) as unread_count
       FROM customer_conversations cc
       JOIN users u ON u.user_id = cc.user_id
       LEFT JOIN customer_messages cm ON cm.conversation_id = cc.conversation_id
       ORDER BY cc.updated_at DESC`,
    ),
  );
});

// Admin: get messages for a conversation
export const getAdminCustomerConversationMessages = createServerFn({ method: "POST" })
  .validator((d) => z.object({ conversation_id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    await requirePermission("messages.view");
    return withDb(async (c) => {
      // Mark customer messages as read
      await c.execute(
        "UPDATE customer_messages SET is_read = 1 WHERE conversation_id = ? AND sender_type = 'customer'",
        [data.conversation_id],
      );
      return rows<CustomerMessageRow>(
        c,
        "SELECT message_id, conversation_id, sender_type, sender_id, sender_name, text, is_read, created_at FROM customer_messages WHERE conversation_id = ? ORDER BY created_at ASC",
        [data.conversation_id],
      );
    });
  });

// Admin: reply to customer conversation
export const adminReplyToCustomerConversation = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        conversation_id: z.number().int(),
        text: z.string().trim().min(1).max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requirePermission("messages.reply");
    return withDb(async (c) => {
      const [conv] = await rows<{ conversation_id: number; user_id: number; subject: string }>(
        c,
        "SELECT conversation_id, user_id, subject FROM customer_conversations WHERE conversation_id = ?",
        [data.conversation_id],
      );
      if (!conv) throw new Error("Conversation not found.");

      await c.beginTransaction();
      try {
        await c.execute(
          "INSERT INTO customer_messages (conversation_id, sender_type, sender_id, sender_name, text) VALUES (?, 'admin', ?, ?, ?)",
          [data.conversation_id, u.user_id, u.name, data.text],
        );

        await c.execute(
          "UPDATE customer_conversations SET status = 'Admin Replied', updated_at = NOW() WHERE conversation_id = ?",
          [data.conversation_id],
        );

        // Notify customer
        await notify(
          conv.user_id,
          "customer_message",
          `Reply on: ${conv.subject}`,
          `Polar Fiber team replied to your message.`,
          `/account?tab=messages&conversation=${data.conversation_id}`,
        );

        await logAction(null, "ADMIN_REPLY_CUSTOMER_CONVERSATION", "conversation", data.conversation_id, null, {
          admin_id: u.user_id,
        });

        await c.commit();
        return { ok: true };
      } catch (e) {
        await c.rollback().catch(() => {});
        throw e;
      }
    });
  });

// =============================================================================
// CUSTOMER ADDRESSES
// =============================================================================

interface AddressRow {
  address_id: number;
  user_id: number;
  label: string;
  recipient: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  country: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export const getCustomerAddresses = createServerFn({ method: "GET" }).handler(async () => {
  const u = await requireUser();
  return withDb((c) =>
    rows<AddressRow>(
      c,
      "SELECT address_id, user_id, label, recipient, phone, line1, line2, city, region, country, is_default, created_at, updated_at FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC",
      [u.user_id],
    ),
  );
});

export const createCustomerAddress = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        label: z.string().trim().min(1).max(80),
        recipient: z.string().trim().min(1).max(100),
        phone: z.string().trim().max(30).default(""),
        line1: z.string().trim().min(1).max(200),
        line2: z.string().trim().max(200).nullable().optional(),
        city: z.string().trim().min(1).max(100).default("Addis Ababa"),
        region: z.string().trim().max(100).nullable().optional(),
        country: z.string().trim().min(1).max(80).default("Ethiopia"),
        is_default: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requireUser();
    return withDb(async (c) => {
      await c.beginTransaction();
      try {
        // If this is default, unset other defaults
        if (data.is_default) {
          await c.execute("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [u.user_id]);
        }

        const [result] = await c.execute(
          "INSERT INTO addresses (user_id, label, recipient, phone, line1, line2, city, region, country, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [u.user_id, data.label, data.recipient, data.phone, data.line1, data.line2 ?? null, data.city, data.region ?? null, data.country, data.is_default ? 1 : 0],
        );
        const addressId = (result as { insertId: number }).insertId;

        await logAction(null, "CREATE_CUSTOMER_ADDRESS", "address", addressId, null, {
          user_id: u.user_id,
          label: data.label,
        });

        await c.commit();
        return { ok: true, address_id: addressId };
      } catch (e) {
        await c.rollback().catch(() => {});
        throw e;
      }
    });
  });

export const updateCustomerAddress = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        address_id: z.number().int(),
        label: z.string().trim().min(1).max(80).optional(),
        recipient: z.string().trim().min(1).max(100).optional(),
        phone: z.string().trim().max(30).optional(),
        line1: z.string().trim().min(1).max(200).optional(),
        line2: z.string().trim().max(200).nullable().optional(),
        city: z.string().trim().min(1).max(100).optional(),
        region: z.string().trim().max(100).nullable().optional(),
        country: z.string().trim().min(1).max(80).optional(),
        is_default: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requireUser();
    const { address_id, ...fields } = data;
    return withDb(async (c) => {
      await c.beginTransaction();
      try {
        // Verify ownership
        const [addr] = await rows<{ address_id: number; user_id: number }>(
          c,
          "SELECT address_id, user_id FROM addresses WHERE address_id = ?",
          [address_id],
        );
        if (!addr || addr.user_id !== u.user_id) throw new Error("Address not found.");

        // If setting as default, unset other defaults
        if (fields.is_default) {
          await c.execute("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [u.user_id]);
        }

        const updates: string[] = [];
        const values: unknown[] = [];
        for (const [key, value] of Object.entries(fields)) {
          if (value !== undefined) {
            updates.push(`${key} = ?`);
            values.push(value === null ? null : value);
          }
        }
        if (updates.length > 0) {
          values.push(address_id);
          await c.execute(`UPDATE addresses SET ${updates.join(", ")} WHERE address_id = ?`, values);
        }

        await logAction(null, "UPDATE_CUSTOMER_ADDRESS", "address", address_id, null, {
          user_id: u.user_id,
          ...fields,
        });

        await c.commit();
        return { ok: true };
      } catch (e) {
        await c.rollback().catch(() => {});
        throw e;
      }
    });
  });

export const deleteCustomerAddress = createServerFn({ method: "POST" })
  .validator((d) => z.object({ address_id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const u = await requireUser();
    return withDb(async (c) => {
      const [addr] = await rows<{ address_id: number; user_id: number; is_default: number }>(
        c,
        "SELECT address_id, user_id, is_default FROM addresses WHERE address_id = ?",
        [data.address_id],
      );
      if (!addr || addr.user_id !== u.user_id) throw new Error("Address not found.");

      await c.execute("DELETE FROM addresses WHERE address_id = ?", [data.address_id]);

      // If deleted address was default, make the most recent one default
      if (addr.is_default) {
        await c.execute(
          "UPDATE addresses SET is_default = 1 WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
          [u.user_id],
        );
      }

      await logAction(null, "DELETE_CUSTOMER_ADDRESS", "address", data.address_id, null, {
        user_id: u.user_id,
      });

      return { ok: true };
    });
  });

export const setDefaultCustomerAddress = createServerFn({ method: "POST" })
  .validator((d) => z.object({ address_id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const u = await requireUser();
    return withDb(async (c) => {
      const [addr] = await rows<{ address_id: number; user_id: number }>(
        c,
        "SELECT address_id, user_id FROM addresses WHERE address_id = ?",
        [data.address_id],
      );
      if (!addr || addr.user_id !== u.user_id) throw new Error("Address not found.");

      await c.execute("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [u.user_id]);
      await c.execute("UPDATE addresses SET is_default = 1 WHERE address_id = ?", [data.address_id]);

      await logAction(null, "SET_DEFAULT_CUSTOMER_ADDRESS", "address", data.address_id, null, {
        user_id: u.user_id,
      });

      return { ok: true };
    });
  });

// =============================================================================
// CUSTOMER FAVORITES
// =============================================================================

interface FavoriteRow {
  id: number;
  user_id: number;
  product_id: number;
  created_at: string;
  product_name?: string;
  product_price?: number;
  product_image?: string;
  product_capacity?: string | null;
}

export const getCustomerFavorites = createServerFn({ method: "GET" }).handler(async () => {
  const u = await requireUser();
  return withDb((c) =>
    rows<FavoriteRow>(
      c,
      `SELECT f.id, f.user_id, f.product_id, f.created_at,
              p.name as product_name, p.price as product_price, p.image as product_image, p.capacity as product_capacity
       FROM favorites f
       JOIN products p ON p.product_id = f.product_id
       WHERE f.user_id = ? AND (p.deleted_at IS NULL OR p.deleted_at = '0000-00-00 00:00:00')
       ORDER BY f.created_at DESC`,
      [u.user_id],
    ),
  );
});

export const toggleCustomerFavorite = createServerFn({ method: "POST" })
  .validator((d) => z.object({ product_id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const u = await requireUser();
    return withDb(async (c) => {
      // Check if already favorited
      const [existing] = await rows<{ id: number }>(
        c,
        "SELECT id FROM favorites WHERE user_id = ? AND product_id = ?",
        [u.user_id, data.product_id],
      );

      if (existing) {
        // Remove from favorites
        await c.execute("DELETE FROM favorites WHERE id = ?", [existing.id]);
        await logAction(null, "REMOVE_CUSTOMER_FAVORITE", "favorite", existing.id, null, {
          user_id: u.user_id,
          product_id: data.product_id,
        });
        return { ok: true, favorited: false };
      } else {
        // Add to favorites
        const [result] = await c.execute(
          "INSERT INTO favorites (user_id, product_id) VALUES (?, ?)",
          [u.user_id, data.product_id],
        );
        const favoriteId = (result as { insertId: number }).insertId;
        await logAction(null, "ADD_CUSTOMER_FAVORITE", "favorite", favoriteId, null, {
          user_id: u.user_id,
          product_id: data.product_id,
        });
        return { ok: true, favorited: true };
      }
    });
  });

export const removeCustomerFavorite = createServerFn({ method: "POST" })
  .validator((d) => z.object({ product_id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const u = await requireUser();
    return withDb(async (c) => {
      await c.execute("DELETE FROM favorites WHERE user_id = ? AND product_id = ?", [u.user_id, data.product_id]);
      await logAction(null, "REMOVE_CUSTOMER_FAVORITE", "favorite", null, null, {
        user_id: u.user_id,
        product_id: data.product_id,
      });
      return { ok: true };
    });
  });
