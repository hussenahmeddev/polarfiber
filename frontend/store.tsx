import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe, getProducts, logout as logoutFn } from "../backend/api.functions";
import type { Product, User } from "../shared/data";

// Cart stays in the browser; everything else lives in MySQL via server functions.
type CartLine = { product_id: number; quantity: number };
type Ctx = {
  user: User | null;
  products: Product[];
  cart: CartLine[];
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  addToCart: (id: number, qty?: number) => void;
  setCartQty: (id: number, qty: number) => void;
  clearCart: () => void;
};

const KEY = "polarfiber-cart-v1";
const StoreCtx = createContext<Ctx | null>(null);
export const productsKey = ["products"];

export function StoreProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const fetchMe = useServerFn(getMe);
  const fetchProducts = useServerFn(getProducts);
  const doLogout = useServerFn(logoutFn);
  const me = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const products = useQuery({ queryKey: productsKey, queryFn: () => fetchProducts() });
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const r = localStorage.getItem(KEY);
      if (r) setCart(JSON.parse(r));
    } catch {
      // Ignore localStorage parse errors
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(cart));
  }, [cart, loaded]);

  const value: Ctx = {
    user: (me.data as User | null) ?? null,
    products: products.data ?? [],
    cart,
    refreshUser: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
    },
    logout: async () => {
      await doLogout();
      qc.clear();
    },
    addToCart: (id, qty = 1) =>
      setCart((p) => {
        const ex = p.find((c) => c.product_id === id);
        return ex
          ? p.map((c) => (c.product_id === id ? { ...c, quantity: c.quantity + qty } : c))
          : [...p, { product_id: id, quantity: qty }];
      }),
    setCartQty: (id, qty) =>
      setCart((p) =>
        qty <= 0
          ? p.filter((c) => c.product_id !== id)
          : p.map((c) => (c.product_id === id ? { ...c, quantity: qty } : c)),
      ),
    clearCart: () => setCart([]),
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore must be used inside StoreProvider");
  return c;
}
