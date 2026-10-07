import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { withDb, rows } from "./db.server";
import { currentUser, endSession, loadUser, requireAdmin, requireUser, startSession } from "./session.server";
import type { Category, Order, OrderStatus, Product, Quote, QuoteStatus } from "../shared/data";
import { CATEGORIES, ORDER_STATUSES, QUOTE_STATUSES } from "../shared/data";

const PRODUCT_SQL = `SELECT p.product_id,p.name,c.name category,p.capacity,p.price,p.stock,p.image,p.description
  FROM products p JOIN categories c ON c.category_id=p.category_id`;

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
    const found = await withDb((c) =>
      rows<{ user_id: number; password_hash: string }>(
        c,
        "SELECT user_id,password_hash FROM users WHERE email=?",
        [data.email.toLowerCase()],
      ),
    );
    if (!found[0] || !(await bcrypt.compare(data.password, found[0].password_hash)))
      return { error: "Wrong email or password." };
    startSession(found[0].user_id);
    return { user: await loadUser(found[0].user_id) };
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
    const hash = await bcrypt.hash(data.password, 10);
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
    return { user: await loadUser(uid) };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  endSession();
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
      // Prices always come from the database, never from the browser.
      const ids = data.items.map((i) => i.product_id);
      const ps = await rows<{ product_id: number; name: string; price: number }>(
        c,
        `SELECT product_id,name,price FROM products WHERE product_id IN (${ids.map(() => "?").join(",")})`,
        ids,
      );
      const lines = data.items.flatMap((i) => {
        const p = ps.find((x) => x.product_id === i.product_id);
        return p ? [{ ...i, p }] : [];
      });
      if (!lines.length) throw new Error("These products are no longer available.");
      const total = lines.reduce((t, l) => t + l.p.price * l.quantity, 0);
      await c.beginTransaction();
      try {
        const [r] = await c.execute("INSERT INTO orders (user_id,total,address) VALUES (?,?,?)", [
          u.user_id,
          total,
          data.address,
        ]);
        const oid = (r as { insertId: number }).insertId;
        for (const l of lines)
          await c.execute(
            "INSERT INTO order_items (order_id,product_id,product_name,quantity,unit_price) VALUES (?,?,?,?,?)",
            [oid, l.product_id, l.p.name, l.quantity, l.p.price],
          );
        await c.commit();
        return { order_id: oid };
      } catch (e) {
        await c.rollback();
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
    const newHash = await bcrypt.hash(data.newPassword, 10);
    await withDb((c) =>
      c.execute("UPDATE users SET password_hash=? WHERE user_id=?", [newHash, u.user_id]),
    );
    return { ok: true };
  });


// ---------- admin ----------
export const getAdminData = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
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
        IF(EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.user_id AND r.role='admin'),'admin','customer') role,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id=u.user_id) orders
       FROM users u ORDER BY u.user_id`,
    ),
  }));
});

export const getAdminOverview = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
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
    await requireAdmin();
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
  await requireAdmin();
  return withDb(async (c) => {
    return rows<{
      user_id: number;
      name: string;
      email: string;
      phone: string;
      role: "customer" | "admin";
      orders_count: number;
      total_spent: number;
      created_at: string;
    }>(
      c,
      `SELECT u.user_id, u.name, u.email, u.phone,
              IF(EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.user_id AND r.role='admin'),'admin','customer') as role,
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
    await requireAdmin();
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
      if (data.product_id === 0)
        await c.execute(
          "INSERT INTO products (category_id,name,capacity,price,stock,image,description) VALUES (?,?,?,?,?,?,?)",
          v,
        );
      else
        await c.execute(
          "UPDATE products SET category_id=?,name=?,capacity=?,price=?,stock=?,image=?,description=? WHERE product_id=?",
          [...v, data.product_id],
        );
    });
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .validator((d) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    await withDb((c) => c.execute("DELETE FROM products WHERE product_id=?", [data.id]));
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
    await requireAdmin();
    await withDb((c) =>
      c.execute("UPDATE orders SET status=? WHERE order_id=?", [
        data.status as OrderStatus,
        data.id,
      ]),
    );
    return { ok: true };
  });

export const setQuoteStatus = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({ id: z.number().int(), status: z.enum(QUOTE_STATUSES) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    await withDb((c) =>
      c.execute("UPDATE quote_requests SET status=? WHERE quote_id=?", [
        data.status as QuoteStatus,
        data.id,
      ]),
    );
    return { ok: true };
  });
