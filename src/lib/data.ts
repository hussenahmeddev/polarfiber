// Sample data for phase 1. Shapes mirror the planned MySQL tables
// (products, categories, users, orders, order_items, quote_requests).
const IMG = "https://polarfiber.com.et/wp-content/uploads";

export type Category = "Water Tankers" | "Flower Pots" | "Roof Sheets" | "Fiber Pipes";
export const CATEGORIES: Category[] = ["Water Tankers", "Flower Pots", "Roof Sheets", "Fiber Pipes"];

export type Product = {
  product_id: number;
  name: string;
  category: Category;
  capacity?: string;
  price: number; // ETB, sample value
  stock: number;
  image: string;
  description: string;
};

export const SEED_PRODUCTS: Product[] = [
  { product_id: 1, name: "Polar Tanker 500L", category: "Water Tankers", capacity: "500 L", price: 6500, stock: 40, image: `${IMG}/2025/06/IMG_9883-768x512.jpg`, description: "Compact rotomolded tank for households. UV-stabilized, food-grade LLDPE." },
  { product_id: 2, name: "Polar Tanker 1,000L", category: "Water Tankers", capacity: "1,000 L", price: 11500, stock: 32, image: `${IMG}/2025/06/IMG_0110-768x512.jpg`, description: "Our most popular home tank. Seamless body with secure locking lid." },
  { product_id: 3, name: "Polar Tanker 2,000L", category: "Water Tankers", capacity: "2,000 L", price: 21000, stock: 18, image: `${IMG}/2025/06/IMG_9884-768x512.jpg`, description: "For larger homes and small businesses. Withstands –10°C to 60°C." },
  { product_id: 4, name: "Polar Tanker 5,000L", category: "Water Tankers", capacity: "5,000 L", price: 48000, stock: 9, image: `${IMG}/2025/06/IMG_9968-768x512.jpg`, description: "Commercial and agricultural storage with reinforced walls." },
  { product_id: 5, name: "Polar Tanker 10,000L", category: "Water Tankers", capacity: "10,000 L", price: 92000, stock: 4, image: `${IMG}/2025/06/IMG_0100-768x512.jpg`, description: "Industrial-capacity tank. Delivery and installation advice included." },
  { product_id: 6, name: "Polar Tanker 25,000L", category: "Water Tankers", capacity: "25,000 L", price: 215000, stock: 0, image: `${IMG}/2025/06/IMG_9893-768x512.jpg`, description: "Made to order for factories, farms and institutions." },
  { product_id: 7, name: "Garden Flower Pot", category: "Flower Pots", price: 900, stock: 120, image: `${IMG}/2025/06/photo_5978789373514205707_y-768x355.jpg`, description: "Durable molded pot for indoor and outdoor plants." },
  { product_id: 8, name: "Fiber Roof Sheet", category: "Roof Sheets", price: 1800, stock: 300, image: `${IMG}/2025/06/photo_5978789373514205748_y-768x355.jpg`, description: "Lightweight, weather-resistant roofing sheet." },
  { product_id: 9, name: "Fiber Pipe 4\"", category: "Fiber Pipes", price: 2400, stock: 75, image: `${IMG}/2025/11/20230402_102116-768x359.jpg`, description: "Strong fiber pipe for water lines and drainage." },
];

export type Role = "customer" | "admin";
export type User = { user_id: number; name: string; email: string; phone: string; role: Role; password: string };

export const SEED_USERS: User[] = [
  { user_id: 1, name: "Admin", email: "admin@polarfiber.com.et", phone: "+251911752298", role: "admin", password: "admin123" },
  { user_id: 2, name: "Abebe Kebede", email: "abebe@example.com", phone: "+251911000001", role: "customer", password: "customer123" },
];

export type OrderStatus = "Pending" | "Confirmed" | "In Production" | "Delivered" | "Cancelled";
export const ORDER_STATUSES: OrderStatus[] = ["Pending", "Confirmed", "In Production", "Delivered", "Cancelled"];
export type OrderItem = { product_id: number; quantity: number; unit_price: number };
export type Order = { order_id: number; user_id: number; items: OrderItem[]; total: number; status: OrderStatus; address: string; created_at: string };

export type QuoteStatus = "New" | "Replied" | "Closed";
export const QUOTE_STATUSES: QuoteStatus[] = ["New", "Replied", "Closed"];
export type Quote = { quote_id: number; user_id: number | null; name: string; email: string; subject: string; message: string; status: QuoteStatus; created_at: string };

export const SEED_ORDERS: Order[] = [
  { order_id: 1001, user_id: 2, items: [{ product_id: 2, quantity: 2, unit_price: 11500 }], total: 23000, status: "In Production", address: "Bole, Addis Ababa", created_at: "2026-09-21" },
  { order_id: 1002, user_id: 2, items: [{ product_id: 7, quantity: 5, unit_price: 900 }], total: 4500, status: "Delivered", address: "Bole, Addis Ababa", created_at: "2026-08-14" },
];

export const SEED_QUOTES: Quote[] = [
  { quote_id: 1, user_id: null, name: "Selam Farms", email: "info@selamfarms.et", subject: "10,000L tanks for irrigation", message: "We need 6 tanks delivered to Debre Zeit.", status: "New", created_at: "2026-09-28" },
];

export const etb = (n: number) => `ETB ${n.toLocaleString("en-US")}`;
