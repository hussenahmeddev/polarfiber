import { createServerFn } from "@tanstack/react-start";
import { getCookie, deleteCookie, getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { withDb, rows } from "./db.server";
import { currentUser, endSession, loadUser, requireAdmin, requirePermission, requireUser, startSession, issueTokenPair, revokeRefreshToken, rotateRefreshToken } from "./session.server";
import type { Category, Order, OrderStatus, Product, Quote, QuoteStatus, Role, StockAdjustment, ContactMessage, SupportTicket } from "../shared/data";
import { CATEGORIES, ORDER_STATUSES, QUOTE_STATUSES } from "../shared/data";
import { getPermissionsForRole } from "../shared/permissions";
import { notify } from "../utils/notify";
import { logAction } from "../utils/audit";
import { changeStock } from "../utils/stock";

const PRODUCT_SQL = `SELECT p.product_id,p.name,c.name category,p.capacity,p.price,p.stock,p.image,p.description
  FROM products p JOIN categories c ON c.category_id=p.category_id`;

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
  withDb((c) => rows<Product>(c, `${PRODUCT_SQL} ORDER BY p.product_id`)),
);

export const getProduct = createServerFn({ method: "POST" })
  .validator((d) => z.object({ id: z.coerce.number().int() }).parse(d))
  .handler(async ({ data }) =>
    withDb(
      async (c) =>
        (await rows<Product>(c, `${PRODUCT_SQL} WHERE p.product_id=?`, [data.id]))[0] ?? null,
    ),
  );

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
      rows<{ user_id: number }>(
        c,
        "SELECT user_id FROM users WHERE email=?",
        [data.email.toLowerCase()],
      ),
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
    z.object({
      token: z.string(),
      password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .max(200)
        .refine((v) => /[a-zA-Z]/.test(v), "Password must contain at least one letter")
        .refine((v) => /[0-9]/.test(v), "Password must contain at least one number"),
    }).parse(d),
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
      await c.execute("UPDATE password_reset_tokens SET used_at=NOW() WHERE id=?", [resetRecord.id]);
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
  "SELECT quote_id,user_id,name,email,subject,message,quoted_amount,valid_until,assigned_to,status,DATE(created_at) created_at FROM quote_requests";

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
            "SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE status != 'Cancelled'",
          )
        )[0];
    const [ordCount] = await rows<{ count: number }>(
      c,
      "SELECT COUNT(*) as count FROM orders",
    );
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
                  COALESCE(SUM(CASE WHEN status != 'Cancelled' THEN total ELSE 0 END), 0) as total
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
      `${PRODUCT_SQL} WHERE p.stock <= 5 ORDER BY p.stock ASC LIMIT 10`,
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
    await requirePermission("orders.view");
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

      return {
        orders: combinedOrders,
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
  category: z.enum(CATEGORIES),
  capacity: z.string().trim().max(40).optional().nullable(),
  price: z.number().positive().max(1e9),
  stock: z.number().int().min(0).max(1e7),
  image: z.string().trim().max(500),
  description: z.string().trim().max(2000),
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
        await logAction(null, "CREATE_PRODUCT", "product", productId, null, data);
      } else {
        const oldRows = await rows<Product>(
          c,
          `${PRODUCT_SQL} WHERE p.product_id=?`,
          [data.product_id],
        );
        const oldProduct = oldRows[0] ?? null;
        if (!oldProduct) throw new Error("Product not found.");

        if (u.role === "staff" && Number(oldProduct.price) !== Number(data.price)) {
          const err = new Error("Staff members are not permitted to modify product prices.");
          (err as any).statusCode = 403;
          throw err;
        }

        const effectivePrice = u.role === "staff" ? oldProduct.price : data.price;
        const v = [
          cat.category_id,
          data.name,
          data.capacity || null,
          effectivePrice,
          data.stock,
          data.image,
          data.description,
        ];
        await c.execute(
          "UPDATE products SET category_id=?,name=?,capacity=?,price=?,stock=?,image=?,description=? WHERE product_id=?",
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
      const oldRows = await rows<Product>(c, `${PRODUCT_SQL} WHERE p.product_id=?`, [data.id]);
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
            const err = new Error("Staff members cannot cancel orders once out for delivery or delivered.");
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
  .validator((d) => z.object({ order_id: z.number().int(), note: z.string().trim().min(1) }).parse(d))
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

      await c.execute("UPDATE orders SET internal_notes=? WHERE order_id=?", [combined, data.order_id]);
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
        await logAction(null, "REQUEST_QUOTE_APPROVAL", "quote", data.id, { status: prevStatus }, {
          status: "Pending Approval",
          quoted_amount: amount,
          valid_until: data.valid_until,
        });
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
        const userRow = await rows<{ user_id: number }>(c, "SELECT user_id FROM users WHERE email=?", [
          existing.email.toLowerCase(),
        ]);
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
        const u = await rows<{ user_id: number }>(c, "SELECT user_id FROM users WHERE email=?", [q.email.toLowerCase()]);
        if (u[0]) targetUserId = u[0].user_id;
      }
      await notify(
        targetUserId,
        "quote_status",
        `Quote Request #${q.quote_id} Approved & Ready`,
        `Your quote request has been approved with quote amount: ETB ${Number(q.quoted_amount).toLocaleString()}.`,
        "/account?tab=quotes",
      );
      await logAction(null, "APPROVE_QUOTE", "quote", data.id, { status: "Pending Approval" }, { status: "Replied" });
      return { ok: true };
    });
  });

export const convertQuoteToOrder = createServerFn({ method: "POST" })
  .validator((d) => z.object({ quote_id: z.number().int() }).parse(d))
  .handler(async () => {
    await requireAdmin(); // Staff gets 403!
    return { ok: true };
  });

export const updateProductStock = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        id: z.number().int(),
        stock: z.number().int().min(0).optional(),
        delta: z.number().int().optional(),
        reason: z.string().trim().min(1, "A mandatory reason must be provided for stock adjustments."),
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

        const [prod] = await rows<{ stock: number }>(c, "SELECT stock FROM products WHERE product_id=? FOR UPDATE", [
          adj.product_id,
        ]);
        if (!prod) throw new Error("Product not found.");

        // changeStock() re-locks under FOR UPDATE and throws if the result
        // would go negative — no silent Math.max(0, …) floor.
        await changeStock(
          c,
          adj.product_id,
          adj.quantity,          // signed: positive = restock, negative = write-down
          `Stock adjustment #${data.id} approved`,
          "manual",
          data.id,
          admin.user_id,
        );
        await c.execute("UPDATE stock_adjustments SET status='approved', reviewed_by=?, reviewed_at=NOW() WHERE id=?", [
          admin.user_id,
          data.id,
        ]);
        await c.commit();

        await notify(
          adj.staff_id,
          "stock_approval",
          "Stock Adjustment Approved",
          `Your stock adjustment request (#${data.id}) for product ID ${adj.product_id} has been approved.`,
          "/admin",
        );
        await logAction(null, "APPROVE_STOCK_ADJUSTMENT", "stock_adjustment", data.id, { status: "pending_approval" }, { status: "approved" });
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
      const [adj] = await rows<StockAdjustment>(
        c,
        "SELECT * FROM stock_adjustments WHERE id=?",
        [data.id],
      );
      if (!adj) throw new Error("Adjustment not found.");
      if (adj.status !== "pending_approval") throw new Error("Adjustment already reviewed.");

      await c.execute("UPDATE stock_adjustments SET status='rejected', reviewed_by=?, reviewed_at=NOW() WHERE id=?", [
        admin.user_id,
        data.id,
      ]);
      await notify(
        adj.staff_id,
        "stock_rejection",
        "Stock Adjustment Rejected",
        `Your stock adjustment request (#${data.id}) was rejected.${data.reason ? ` Reason: ${data.reason}` : ""}`,
        "/admin",
      );
      await logAction(null, "REJECT_STOCK_ADJUSTMENT", "stock_adjustment", data.id, { status: "pending_approval" }, { status: "rejected" });
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

export const getAuditLogs = createServerFn({ method: "GET" }).handler(async () => {
  // audit.view is NOT in STAFF_PERMISSIONS — staff gets 403 here.
  await requirePermission("audit.view");
  return withDb((c) =>
    rows<{
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
      "SELECT id, actor_id, actor_name, ip_address, action, entity_type, entity_id, CAST(old_values AS CHAR) old_values, CAST(new_values AS CHAR) new_values, created_at FROM audit_logs ORDER BY id DESC LIMIT 100",
    ),
  );
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
      const [target] = await rows<{ user_id: number }>(c, "SELECT user_id FROM users WHERE email=?", [
        data.email.toLowerCase(),
      ]);
      if (target) {
        await notify(
          target.user_id,
          "message_reply",
          "New Message from Polar Fiber Support",
          data.message,
          "/account?tab=support",
        );
      }
      await logAction(null, "REPLY_MESSAGE", "message", data.message_id ?? data.quote_id ?? data.email, null, {
        email: data.email,
        message: data.message,
      });
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
          const err = new Error("Cannot reassign a support ticket already assigned to another staff member.");
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
        status: z.enum(["Open", "In Progress", "Resolved"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission("support.update_status");
    return withDb(async (c) => {
      const [ticket] = await rows<{ id: number; status: string; customer_email: string; user_id: number | null }>(
        c,
        "SELECT id, status, customer_email, user_id FROM support_tickets WHERE id=?",
        [data.ticket_id],
      );
      if (!ticket) throw new Error("Support ticket not found.");

      await c.execute("UPDATE support_tickets SET status=? WHERE id=?", [data.status, data.ticket_id]);
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
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requirePermission("support.reply");
    await withDb(async (c) => {
      const tId = Number(data.ticket_id);
      if (!Number.isNaN(tId) && tId > 0) {
        await c.execute(
          "INSERT INTO ticket_replies (ticket_id, user_id, message) VALUES (?, ?, ?)",
          [tId, u.user_id, data.reply],
        );
      }
      let targetUserId = data.user_id;
      if (!targetUserId && data.customer_email) {
        const [target] = await rows<{ user_id: number }>(c, "SELECT user_id FROM users WHERE email=?", [
          data.customer_email.toLowerCase(),
        ]);
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
      await logAction(null, "REPLY_SUPPORT_TICKET", "ticket", data.ticket_id, null, {
        reply: data.reply,
      });
    });
    return { ok: true };
  });

export const getCompanySettings = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin(); // Staff gets 403!
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
      await c.execute(
        "INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=?",
        [data.key, data.value, data.value],
      );
      await logAction(null, "UPDATE_SETTING", "setting", data.key, null, { value: data.value });
      return { ok: true };
    });
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({
      userId: z.number().int().positive(),
      role: z.enum(["customer", "admin", "staff"]),
    }).parse(d),
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
        temporaryPassword: z.string().min(8, "Temporary password must be at least 8 characters").max(200),
        role: z.enum(["staff", "admin"]).default("staff"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    return withDb(async (c) => {
      const email = data.email.toLowerCase();
      const existing = await rows<{ user_id: number }>(c, "SELECT user_id FROM users WHERE email=?", [email]);
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

      await logAction(
        null,
        "CREATE_TEAM_MEMBER",
        "user",
        newUserId,
        null,
        { name: data.name, email, role: data.role, must_change_password: true },
      );

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


