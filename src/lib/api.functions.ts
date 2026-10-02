import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { withDb, rows } from "./db.server";
import { currentUser, endSession, requireAdmin, requireUser, startSession } from "./session.server";
import type { Category, Order, OrderStatus, Product, Quote, QuoteStatus } from "./data";

const PRODUCT_SQL = `SELECT p.product_id,p.name,c.name category,p.capacity,p.price,p.stock,p.image,p.description
  FROM products p JOIN categories c ON c.category_id=p.category_id`;

// ---------- catalog ----------
export const getProducts = createServerFn({ method: "GET" }).handler(async () =>
  withDb((c) => rows<Product>(c, `${PRODUCT_SQL} ORDER BY p.product_id`)));

export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.coerce.number().int() }).parse(d))
  .handler(async ({ data }) => withDb(async (c) => (await rows<Product>(c, `${PRODUCT_SQL} WHERE p.product_id=?`, [data.id]))[0] ?? null));

// ---------- auth ----------
export const getMe = createServerFn({ method: "GET" }).handler(() => currentUser());

export const login = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().trim().email().max(255), password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const found = await withDb((c) => rows<{ user_id: number; password_hash: string }>(c, "SELECT user_id,password_hash FROM users WHERE email=?", [data.email.toLowerCase()]));
    if (!found[0] || !(await bcrypt.compare(data.password, found[0].password_hash))) return { error: "Wrong email or password." };
    startSession(found[0].user_id);
    return { user: await currentUser() };
  });

export const register = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    name: z.string().trim().min(1).max(100), email: z.string().trim().email().max(255),
    phone: z.string().trim().max(20), password: z.string().min(6).max(200),
  }).parse(d))
  .handler(async ({ data }) => {
    const hash = await bcrypt.hash(data.password, 10);
    const uid = await withDb(async (c) => {
      const exists = await rows(c, "SELECT 1 FROM users WHERE email=?", [data.email.toLowerCase()]);
      if (exists.length) return null;
      const [r] = await c.execute("INSERT INTO users (name,email,phone,password_hash) VALUES (?,?,?,?)", [data.name, data.email.toLowerCase(), data.phone, hash]);
      const id = (r as { insertId: number }).insertId;
      await c.execute("INSERT INTO user_roles (user_id,role) VALUES (?, 'customer')", [id]);
      // The very first account becomes the administrator.
      const admins = await rows(c, "SELECT 1 FROM user_roles WHERE role='admin' LIMIT 1");
      if (!admins.length) await c.execute("INSERT INTO user_roles (user_id,role) VALUES (?, 'admin')", [id]);
      return id;
    });
    if (!uid) return { error: "An account with this email already exists." };
    startSession(uid);
    return { user: await currentUser() };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => { endSession(); return { ok: true }; });

// ---------- orders & quotes ----------
async function loadOrders(where: string, params: unknown[]): Promise<Order[]> {
  return withDb(async (c) => {
    const os = await rows<Omit<Order, "items"> & { customer: string }>(c,
      `SELECT o.order_id,o.user_id,o.total,o.status,o.address,DATE(o.created_at) created_at,u.name customer
       FROM orders o JOIN users u ON u.user_id=o.user_id ${where} ORDER BY o.order_id DESC`, params);
    if (!os.length) return [];
    const items = await rows<{ order_id: number; product_id: number; product_name: string; quantity: number; unit_price: number }>(c,
      `SELECT order_id,product_id,product_name,quantity,unit_price FROM order_items WHERE order_id IN (${os.map(() => "?").join(",")})`, os.map((o) => o.order_id));
    return os.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.order_id) }));
  });
}

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    address: z.string().trim().min(1).max(200),
    items: z.array(z.object({ product_id: z.number().int(), quantity: z.number().int().min(1).max(1000) })).min(1).max(50),
  }).parse(d))
  .handler(async ({ data }) => {
    const u = await requireUser();
    return withDb(async (c) => {
      // Prices always come from the database, never from the browser.
      const ids = data.items.map((i) => i.product_id);
      const ps = await rows<{ product_id: number; name: string; price: number }>(c,
        `SELECT product_id,name,price FROM products WHERE product_id IN (${ids.map(() => "?").join(",")})`, ids);
      const lines = data.items.flatMap((i) => { const p = ps.find((x) => x.product_id === i.product_id); return p ? [{ ...i, p }] : []; });
      if (!lines.length) throw new Error("These products are no longer available.");
      const total = lines.reduce((t, l) => t + l.p.price * l.quantity, 0);
      await c.beginTransaction();
      try {
        const [r] = await c.execute("INSERT INTO orders (user_id,total,address) VALUES (?,?,?)", [u.user_id, total, data.address]);
        const oid = (r as { insertId: number }).insertId;
        for (const l of lines) await c.execute("INSERT INTO order_items (order_id,product_id,product_name,quantity,unit_price) VALUES (?,?,?,?,?)", [oid, l.product_id, l.p.name, l.quantity, l.p.price]);
        await c.commit();
        return { order_id: oid };
      } catch (e) { await c.rollback(); throw e; }
    });
  });

export const submitQuote = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    name: z.string().trim().min(1).max(100), email: z.string().trim().email().max(255),
    subject: z.string().trim().min(1).max(150), message: z.string().trim().min(1).max(2000),
  }).parse(d))
  .handler(async ({ data }) => {
    const u = await currentUser();
    await withDb((c) => c.execute("INSERT INTO quote_requests (user_id,name,email,subject,message) VALUES (?,?,?,?,?)", [u?.user_id ?? null, data.name, data.email, data.subject, data.message]));
    return { ok: true };
  });

const QUOTE_SQL = "SELECT quote_id,user_id,name,email,subject,message,status,DATE(created_at) created_at FROM quote_requests";

export const getMyAccount = createServerFn({ method: "GET" }).handler(async () => {
  const u = await requireUser();
  const orders = await loadOrders("WHERE o.user_id=?", [u.user_id]);
  const quotes = await withDb((c) => rows<Quote>(c, `${QUOTE_SQL} WHERE user_id=? OR email=? ORDER BY quote_id DESC`, [u.user_id, u.email]));
  return { orders, quotes };
});

// ---------- admin ----------
export const getAdminData = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const orders = await loadOrders("", []);
  return withDb(async (c) => ({
    orders,
    quotes: await rows<Quote>(c, `${QUOTE_SQL} ORDER BY quote_id DESC`),
    products: await rows<Product>(c, `${PRODUCT_SQL} ORDER BY p.product_id`),
    users: await rows<{ user_id: number; name: string; email: string; phone: string; role: string; orders: number }>(c,
      `SELECT u.user_id,u.name,u.email,u.phone,
        IF(EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.user_id AND r.role='admin'),'admin','customer') role,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id=u.user_id) orders
       FROM users u ORDER BY u.user_id`),
  }));
});

const productInput = z.object({
  product_id: z.number().int().min(0), name: z.string().trim().min(1).max(150),
  category: z.enum(["Water Tankers", "Flower Pots", "Roof Sheets", "Fiber Pipes"]),
  capacity: z.string().trim().max(40).optional().nullable(), price: z.number().positive().max(1e9),
  stock: z.number().int().min(0).max(1e7), image: z.string().trim().max(500), description: z.string().trim().max(2000),
});

export const saveProduct = createServerFn({ method: "POST" })
  .inputValidator((d) => productInput.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    await withDb(async (c) => {
      const cat = (await rows<{ category_id: number }>(c, "SELECT category_id FROM categories WHERE name=?", [data.category as Category]))[0];
      const v = [cat.category_id, data.name, data.capacity || null, data.price, data.stock, data.image, data.description];
      if (data.product_id === 0) await c.execute("INSERT INTO products (category_id,name,capacity,price,stock,image,description) VALUES (?,?,?,?,?,?,?)", v);
      else await c.execute("UPDATE products SET category_id=?,name=?,capacity=?,price=?,stock=?,image=?,description=? WHERE product_id=?", [...v, data.product_id]);
    });
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data }) => { await requireAdmin(); await withDb((c) => c.execute("DELETE FROM products WHERE product_id=?", [data.id])); return { ok: true }; });

export const setOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.number().int(), status: z.enum(["Pending", "Confirmed", "In Production", "Delivered", "Cancelled"]) }).parse(d))
  .handler(async ({ data }) => { await requireAdmin(); await withDb((c) => c.execute("UPDATE orders SET status=? WHERE order_id=?", [data.status as OrderStatus, data.id])); return { ok: true }; });

export const setQuoteStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.number().int(), status: z.enum(["New", "Replied", "Closed"]) }).parse(d))
  .handler(async ({ data }) => { await requireAdmin(); await withDb((c) => c.execute("UPDATE quote_requests SET status=? WHERE quote_id=?", [data.status as QuoteStatus, data.id])); return { ok: true }; });
