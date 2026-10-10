import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMe,
  getProducts,
  logout as logoutFn,
  refreshTokens as refreshTokensFn,
} from "../backend/api.functions";
import type { Product, User } from "../shared/data";

// Cart stays in the browser; everything else lives in MySQL via server functions.
type CartLine = { product_id: number; quantity: number };
type Ctx = {
  // undefined = still loading, null = definitively logged out, User = authenticated
  user: User | null | undefined;
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
  const doRefreshTokens = useServerFn(refreshTokensFn);

  // Tracks whether the user has explicitly logged out. While true, the ["me"]
  // query stays disabled so it cannot silently re-authenticate via a surviving
  // cookie before the page navigates away.
  const loggedOut = useRef(false);

  const me = useQuery({
    queryKey: ["me"],
    enabled: !loggedOut.current,
    queryFn: async () => {
      try {
        return await fetchMe();
      } catch {
        // Access token may have expired — try a refresh once, then retry
        try {
          await doRefreshTokens();
          return await fetchMe();
        } catch {
          return null;
        }
      }
    },
    retry: false,
  });

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

  // If query data was seeded externally (e.g. after login via qc.setQueryData),
  // treat it as a sign-in and re-enable the query for future use.
  if (loggedOut.current && me.data) {
    loggedOut.current = false;
  }

  const value: Ctx = {
    // undefined while the query is in-flight, null when definitely not logged in
    user: loggedOut.current ? null : (me.isPending ? undefined : ((me.data as User | null) ?? null)),
    products: products.data ?? [],
    cart,
    refreshUser: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
    },
    logout: async () => {
      // Disable the ["me"] query BEFORE the server call so it cannot
      // re-fire and restore the session via a surviving cookie.
      loggedOut.current = true;
      await doLogout();
      qc.setQueryData(["me"], null);
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
