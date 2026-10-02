// Shared types matching the MySQL tables (see db/schema.sql).
export type Category = "Water Tankers" | "Flower Pots" | "Roof Sheets" | "Fiber Pipes";
export const CATEGORIES: Category[] = ["Water Tankers", "Flower Pots", "Roof Sheets", "Fiber Pipes"];

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

export type OrderStatus = "Pending" | "Confirmed" | "In Production" | "Delivered" | "Cancelled";
export const ORDER_STATUSES: OrderStatus[] = ["Pending", "Confirmed", "In Production", "Delivered", "Cancelled"];
export type OrderItem = { product_id: number | null; product_name: string; quantity: number; unit_price: number };
export type Order = { order_id: number; user_id: number; customer?: string; items: OrderItem[]; total: number; status: OrderStatus; address: string; created_at: string };

export type QuoteStatus = "New" | "Replied" | "Closed";
export const QUOTE_STATUSES: QuoteStatus[] = ["New", "Replied", "Closed"];
export type Quote = { quote_id: number; user_id: number | null; name: string; email: string; subject: string; message: string; status: QuoteStatus; created_at: string };

export const etb = (n: number) => `ETB ${Number(n).toLocaleString("en-US")}`;
