// Shared types matching the MySQL tables (see db/schema.sql).
export const CATEGORIES = [
  "Water Tankers",
  "Flower Pots",
  "Roof Sheets",
  "Fiber Pipes",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Product = {
  product_id: number;
  name: string;
  category: Category;
  capacity?: string | null;
  price: number;
  stock: number;
  image: string;
  description: string;
};

export type Role = "customer" | "admin";
export type User = { user_id: number; name: string; email: string; phone: string; role: Role };

export const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "In Production",
  "Delivered",
  "Cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderItem = {
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
};
export type Order = {
  order_id: number;
  user_id: number;
  customer?: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  address: string;
  created_at: string;
};

export const QUOTE_STATUSES = ["New", "Replied", "Closed"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export type Quote = {
  quote_id: number;
  user_id: number | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: QuoteStatus;
  created_at: string;
};

export const etb = (n: number) => `ETB ${Number(n).toLocaleString("en-US")}`;
