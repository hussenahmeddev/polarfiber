import { createServerFn } from "@tanstack/react-start";
import { getCookie, deleteCookie, getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { withDb, rows } from "./db.server";
import { currentUser, endSession, loadUser, requireAdmin, requireStaffOrAdmin, requireUser, startSession, issueTokenPair, revokeRefreshToken, rotateRefreshToken } from "./session.server";
import type { Category, Order, OrderStatus, Product, Quote, QuoteStatus } from "../shared/data";
import { CATEGORIES, ORDER_STATUSES, QUOTE_STATUSES } from "../shared/data";
import { notify } from "../utils/notify";
import { logAction } from "../utils/audit";

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
        password: z.string().min(6).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const hash = await bcrypt.hash(data.password, 12);
    const uid = await withDb(async (c) => {
      const exists = await rows(c, "SELECT 1 FROM users WHERE email=?", [data.email.toLowerCase()]);
      if (exists.length) return null;
      const [r] = await c.execute(
        "INSERT INTO users (name,email,phone,password_hash) VALUES (?,?,?,?)",
        [data.name, data.email.toLowerCase(), data.phone, hash],
      );
      const id = (r as { insertId: number }).insertId;
      await c.execute("INSERT INTO user_roles (user_id,role) VALUES (?, 'customer')", [id]);
      // The very first account becomes the administrator.
      const admins = await rows(c, "SELECT 1 FROM user_roles WHERE role='admin' LIMIT 1");
      if (!admins.length)
        await c.execute("INSERT INTO user_roles (user_id,role) VALUES (?, 'admin')", [id]);
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
  deleteCookie("pf_access", { path: "/" });
  deleteCookie("pf_refresh", { path: "/" });
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
      console.log("[DEV] password reset token for", data.email, ":", plainToken);
    }
    return { ok: true };
  });

export const resetPassword = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({ token: z.string(), password: z.string().min(6) }).parse(d),
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
      `SELECT o.order_id,o.user_id,o.total,o.status,o.address,DATE(o.created_at) created_at,u.name customer
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
        // Prices and stock always come from the database using SELECT ... FOR UPDATE
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

        // Verify stock for each item before deducting (stock never goes negative)
        for (const l of lines) {
          if (l.p.stock < l.quantity) {
            throw new Error(`Insufficient stock for "${l.p.name}". Only ${l.p.stock} available.`);
          }
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

          // Deduct stock safely inside transaction
          await c.execute(
            "UPDATE products SET stock = stock - ? WHERE product_id = ? AND stock >= ?",
            [l.quantity, l.product_id, l.quantity],
          );

          // Record stock movement (type 'out' for order)
          await c.execute(
            "INSERT INTO stock_movements (product_id, quantity, type, reference_type, reference_id) VALUES (?, ?, 'out', 'order', ?)",
            [l.product_id, l.quantity, oid],
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
  "SELECT quote_id,user_id,name,email,subject,message,status,DATE(created_at) created_at FROM quote_requests";

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
      c.execute("UPDATE users SET password_hash=? WHERE user_id=?", [newHash, u.user_id]),
    );
    return { ok: true };
  });


// ---------- admin & staff ----------
export const getAdminData = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaffOrAdmin();
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
  await requireStaffOrAdmin();
  return withDb(async (c) => {
    // 1. KPI stats
    const [rev] = await rows<{ revenue: number }>(
      c,
      "SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE status != 'Cancelled'",
    );
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
    const timeline = await rows<{ date: string; count: number; total: number }>(
      c,
      `SELECT DATE(created_at) as date,
              COUNT(*) as count,
              COALESCE(SUM(CASE WHEN status != 'Cancelled' THEN total ELSE 0 END), 0) as total
       FROM orders
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`,
    );

    // 3. Category Revenue breakdown
    const categoryRevenue = await rows<{ category: string; revenue: number; count: number }>(
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
    const pendingOrders = await loadOrders("WHERE o.status='Pending' LIMIT 10", []);
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
        totalRevenue: Number(rev?.revenue ?? 0),
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
    await requireStaffOrAdmin();
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
      const ordersSql = `SELECT o.order_id,o.user_id,o.total,o.status,o.address,DATE(o.created_at) created_at,u.name customer
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
  await requireStaffOrAdmin();
  return withDb(async (c) => {
    return rows<{
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
    await requireStaffOrAdmin();
    let productId = data.product_id;
    await withDb(async (c) => {
      const cat = (
        await rows<{ category_id: number }>(c, "SELECT category_id FROM categories WHERE name=?", [
          data.category as Category,
        ])
      )[0];
      if (!cat) throw new Error("Unknown category.");
      const v = [
        cat.category_id,
        data.name,
        data.capacity || null,
        data.price,
        data.stock,
        data.image,
        data.description,
      ];
      if (data.product_id === 0) {
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
        await c.execute(
          "UPDATE products SET category_id=?,name=?,capacity=?,price=?,stock=?,image=?,description=? WHERE product_id=?",
          [...v, data.product_id],
        );
        await logAction(null, "UPDATE_PRODUCT", "product", data.product_id, oldProduct, data);
      }
    });
    return { ok: true, product_id: productId };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .validator((d) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    await requireStaffOrAdmin();
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
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaffOrAdmin();
    await withDb(async (c) => {
      await c.beginTransaction();
      try {
        const [existing] = await rows<{ order_id: number; user_id: number; status: OrderStatus }>(
          c,
          "SELECT order_id, user_id, status FROM orders WHERE order_id=? FOR UPDATE",
          [data.id],
        );
        if (!existing) throw new Error("Order not found.");

        const prevStatus = existing.status;
        const newStatus = data.status as OrderStatus;

        // Stock restored when order is cancelled from any status before 'delivered'
        // Do NOT deduct again on 'confirmed'.
        if (newStatus === "Cancelled" && prevStatus !== "Cancelled" && prevStatus !== "Delivered") {
          const items = await rows<{ product_id: number; quantity: number }>(
            c,
            "SELECT product_id, quantity FROM order_items WHERE order_id=?",
            [data.id],
          );
          for (const item of items) {
            if (item.product_id) {
              await c.execute("UPDATE products SET stock = stock + ? WHERE product_id = ?", [
                item.quantity,
                item.product_id,
              ]);
              await c.execute(
                "INSERT INTO stock_movements (product_id, quantity, type, reference_type, reference_id) VALUES (?, ?, 'in', 'order', ?)",
                [item.product_id, item.quantity, data.id],
              );
            }
          }
        }

        await c.execute("UPDATE orders SET status=? WHERE order_id=?", [newStatus, data.id]);
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
          { status: newStatus },
        );
      } catch (err) {
        await c.rollback().catch(() => {});
        throw err;
      }
    });
    return { ok: true };
  });

export const setQuoteStatus = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({ id: z.number().int(), status: z.enum(QUOTE_STATUSES) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaffOrAdmin();
    await withDb(async (c) => {
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
      const newStatus = data.status as QuoteStatus;

      await c.execute("UPDATE quote_requests SET status=? WHERE quote_id=?", [
        newStatus,
        data.id,
      ]);

      let targetUserId = existing.user_id;
      if (!targetUserId && existing.email) {
        const u = await rows<{ user_id: number }>(c, "SELECT user_id FROM users WHERE email=?", [
          existing.email.toLowerCase(),
        ]);
        if (u[0]) targetUserId = u[0].user_id;
      }

      await notify(
        targetUserId,
        "quote_status",
        `Quote Request #${existing.quote_id} Updated`,
        `Your quote request status has been updated to ${newStatus}.`,
        `/account?tab=quotes`,
      );

      await logAction(
        null,
        "UPDATE_QUOTE_STATUS",
        "quote",
        data.id,
        { status: prevStatus },
        { status: newStatus },
      );
    });
    return { ok: true };
  });

export const updateProductStock = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({
      id: z.number().int(),
      stock: z.number().int().min(0),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaffOrAdmin();
    await withDb(async (c) => {
      const oldRows = await rows<{ stock: number }>(c, "SELECT stock FROM products WHERE product_id=?", [data.id]);
      const oldStock = oldRows[0]?.stock ?? 0;
      await c.execute("UPDATE products SET stock=? WHERE product_id=?", [
        data.stock,
        data.id,
      ]);
      await logAction(null, "UPDATE_PRODUCT_STOCK", "product", data.id, { stock: oldStock }, { stock: data.stock });
    });
    return { ok: true };
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
  await requireStaffOrAdmin();
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

export const replyContactMessage = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({
      quote_id: z.number().int().optional(),
      email: z.string().email(),
      message: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaffOrAdmin();
    await withDb(async (c) => {
      const [u] = await rows<{ user_id: number }>(c, "SELECT user_id FROM users WHERE email=?", [
        data.email.toLowerCase(),
      ]);
      if (u) {
        await notify(
          u.user_id,
          "message_reply",
          "New Message from Polar Fiber Support",
          data.message,
          "/account?tab=support",
        );
      }
      await logAction(null, "REPLY_MESSAGE", "message", data.quote_id ?? data.email, null, {
        email: data.email,
        message: data.message,
      });
    });
    return { ok: true };
  });

export const replySupportTicket = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({
      ticket_id: z.string(),
      user_id: z.number().int().optional(),
      customer_email: z.string().email().optional(),
      reply: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaffOrAdmin();
    await withDb(async (c) => {
      let targetUserId = data.user_id;
      if (!targetUserId && data.customer_email) {
        const [u] = await rows<{ user_id: number }>(c, "SELECT user_id FROM users WHERE email=?", [
          data.customer_email.toLowerCase(),
        ]);
        if (u) targetUserId = u.user_id;
      }
      if (targetUserId) {
        await notify(
          targetUserId,
          "ticket_reply",
          `Reply on Ticket ${data.ticket_id}`,
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

export const updateUserRole = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({
      userId: z.number().int().positive(),
      role: z.enum(["customer", "admin", "staff"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    return withDb(async (c) => {
      if (data.role !== "admin") {
        const [adminCount] = await rows<{ count: number }>(
          c,
          "SELECT COUNT(*) as count FROM user_roles WHERE role='admin'",
        );
        const [isTargetAdmin] = await rows<{ user_id: number }>(
          c,
          "SELECT user_id FROM user_roles WHERE user_id=? AND role='admin'",
          [data.userId],
        );
        if (isTargetAdmin && (adminCount?.count ?? 0) <= 1) {
          throw new Error("Cannot demote the last remaining administrator.");
        }
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

      await c.execute("DELETE FROM user_roles WHERE user_id=?", [data.userId]);
      await c.execute("INSERT INTO user_roles (user_id, role) VALUES (?, ?)", [
        data.userId,
        data.role,
      ]);

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

