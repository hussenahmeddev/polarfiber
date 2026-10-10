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

export type Role = "customer" | "admin" | "staff";
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

export type CustomerDashboardStats = {
  activeOrders: number;
  deliveredOrders: number;
  openQuotes: number;
};

export type CustomerDashboardData = {
  stats: CustomerDashboardStats;
  recentOrders: Order[];
};

export type AdminOverviewKPIs = {
  totalRevenue: number;
  totalOrders: number;
  newQuotes: number;
  lowStockCount: number;
};

export type TimelinePoint = {
  date: string;
  count: number;
  total: number;
};

export type CategoryRevenuePoint = {
  category: string;
  revenue: number;
  count: number;
};

export type StatusDistributionPoint = {
  status: OrderStatus;
  count: number;
  percentage: number;
};

export type AdminAttentionData = {
  pendingOrders: Order[];
  newQuotes: Quote[];
  lowStockProducts: Product[];
};

export type AdminOverviewData = {
  kpis: AdminOverviewKPIs;
  timeline: TimelinePoint[];
  categoryRevenue: CategoryRevenuePoint[];
  statusDistribution: StatusDistributionPoint[];
  attention: AdminAttentionData;
};

export type PaginatedOrders = {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CustomerSummary = {
  user_id: number;
  name: string;
  email: string;
  phone: string;
  role: Role;
  orders_count: number;
  total_spent: number;
  created_at: string;
};

export type StockMovement = {
  id: number;
  product_id: number;
  quantity: number;
  type: "in" | "out";
  reference_type: string;
  reference_id: number;
  created_at: string;
};

export type Notification = {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body: string;
  link_url?: string | null;
  is_read: boolean | number;
  created_at: string;
};

export type AuditLog = {
  id: number;
  actor_id?: number | null;
  actor_name?: string | null;
  ip_address?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values?: string | Record<string, unknown> | null;
  new_values?: string | Record<string, unknown> | null;
  created_at: string;
};

