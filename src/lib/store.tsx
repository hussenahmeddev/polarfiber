import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  SEED_ORDERS, SEED_PRODUCTS, SEED_QUOTES, SEED_USERS,
  type Order, type OrderStatus, type Product, type Quote, type QuoteStatus, type User,
} from "./data";

// Temporary browser-only store. Replace with API calls when the database is connected.
type CartLine = { product_id: number; quantity: number };
type State = { products: Product[]; users: User[]; orders: Order[]; quotes: Quote[]; cart: CartLine[]; currentUserId: number | null };

const KEY = "polarfiber-demo-v1";
const initial: State = { products: SEED_PRODUCTS, users: SEED_USERS, orders: SEED_ORDERS, quotes: SEED_QUOTES, cart: [], currentUserId: null };

type Ctx = State & {
  user: User | null;
  login: (email: string, password: string) => User | null;
  register: (u: Omit<User, "user_id" | "role">) => string | null;
  logout: () => void;
  addToCart: (id: number, qty?: number) => void;
  setCartQty: (id: number, qty: number) => void;
  placeOrder: (address: string) => Order | null;
  submitQuote: (q: Pick<Quote, "name" | "email" | "subject" | "message">) => void;
  saveProduct: (p: Product) => void;
  deleteProduct: (id: number) => void;
  setOrderStatus: (id: number, s: OrderStatus) => void;
  setQuoteStatus: (id: number, s: QuoteStatus) => void;
};

const StoreCtx = createContext<Ctx | null>(null);
const today = () => new Date().toISOString().slice(0, 10);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setS({ ...initial, ...JSON.parse(raw) }); } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) localStorage.setItem(KEY, JSON.stringify(s)); }, [s, loaded]);

  const user = s.users.find((u) => u.user_id === s.currentUserId) ?? null;

  const value: Ctx = {
    ...s,
    user,
    login: (email, password) => {
      const u = s.users.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password);
      if (u) setS((p) => ({ ...p, currentUserId: u.user_id }));
      return u ?? null;
    },
    register: (u) => {
      if (s.users.some((x) => x.email.toLowerCase() === u.email.toLowerCase())) return "An account with this email already exists.";
      const id = Math.max(...s.users.map((x) => x.user_id)) + 1;
      setS((p) => ({ ...p, users: [...p.users, { ...u, user_id: id, role: "customer" }], currentUserId: id }));
      return null;
    },
    logout: () => setS((p) => ({ ...p, currentUserId: null })),
    addToCart: (id, qty = 1) => setS((p) => {
      const ex = p.cart.find((c) => c.product_id === id);
      return { ...p, cart: ex ? p.cart.map((c) => c.product_id === id ? { ...c, quantity: c.quantity + qty } : c) : [...p.cart, { product_id: id, quantity: qty }] };
    }),
    setCartQty: (id, qty) => setS((p) => ({ ...p, cart: qty <= 0 ? p.cart.filter((c) => c.product_id !== id) : p.cart.map((c) => c.product_id === id ? { ...c, quantity: qty } : c) })),
    placeOrder: (address) => {
      if (!user || s.cart.length === 0) return null;
      const items = s.cart.map((c) => ({ ...c, unit_price: s.products.find((p) => p.product_id === c.product_id)?.price ?? 0 }));
      const order: Order = {
        order_id: Math.max(1000, ...s.orders.map((o) => o.order_id)) + 1,
        user_id: user.user_id, items, address, status: "Pending", created_at: today(),
        total: items.reduce((t, i) => t + i.unit_price * i.quantity, 0),
      };
      setS((p) => ({ ...p, orders: [order, ...p.orders], cart: [] }));
      return order;
    },
    submitQuote: (q) => setS((p) => ({ ...p, quotes: [{ ...q, quote_id: Math.max(0, ...p.quotes.map((x) => x.quote_id)) + 1, user_id: p.currentUserId, status: "New", created_at: today() }, ...p.quotes] })),
    saveProduct: (prod) => setS((p) => ({
      ...p,
      products: prod.product_id === 0
        ? [...p.products, { ...prod, product_id: Math.max(0, ...p.products.map((x) => x.product_id)) + 1 }]
        : p.products.map((x) => x.product_id === prod.product_id ? prod : x),
    })),
    deleteProduct: (id) => setS((p) => ({ ...p, products: p.products.filter((x) => x.product_id !== id) })),
    setOrderStatus: (id, st) => setS((p) => ({ ...p, orders: p.orders.map((o) => o.order_id === id ? { ...o, status: st } : o) })),
    setQuoteStatus: (id, st) => setS((p) => ({ ...p, quotes: p.quotes.map((q) => q.quote_id === id ? { ...q, status: st } : q) })),
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore must be used inside StoreProvider");
  return c;
}
