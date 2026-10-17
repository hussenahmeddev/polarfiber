// Shared types matching the MySQL tables (see db/schema.sql).
export const CATEGORIES = ["Water Tankers", "Flower Pots", "Roof Sheets", "Fiber Pipes"] as const;
export type Category = (typeof CATEGORIES)[number];

export type Product = {
  product_id: number;
  sku?: string | null;
  name: string;
  slug?: string | null;
  category: Category;
  capacity?: string | null;
  price: number;
  stock: number;
  image: string;
  description: string;
  status?: "active" | "draft" | "archived";
  deleted_at?: string | null;
  has_db_image?: number | boolean;
};

export type Role = "customer" | "admin" | "staff";
export type User = {
  user_id: number;
  name: string;
  email: string;
  phone: string;
  role: Role;
  must_change_password?: boolean;
};

export const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "In Production",
  "Out for Delivery",
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
  user_id: number | null;
  customer?: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  address: string;
  is_paid?: boolean | number;
  payment_method?: string;
  internal_notes?: string | null;
  created_at: string;
};

export type OrderAccess = {
  order_id: number;
  access_pass: string;
  email: string;
  created_at: string;
};

export const QUOTE_STATUSES = [
  "New",
  "Reviewing",
  "Pending Approval",
  "Replied",
  "Accepted",
  "Closed",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export type Quote = {
  quote_id: number;
  user_id: number | null;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  delivery_location?: string | null;
  quoted_amount?: number | null;
  valid_until?: string | null;
  assigned_to?: number | null;
  status: QuoteStatus;
  created_at: string;
};

export type StockAdjustment = {
  id: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  reason: string;
  status: "pending_approval" | "approved" | "rejected";
  staff_id: number;
  staff_name?: string;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  created_at: string;
};

export type ContactMessage = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  is_read: boolean | number;
  is_archived: boolean | number;
  created_at: string;
};

export type SupportTicket = {
  id: number;
  ticket_code: string;
  customer_name: string;
  customer_email: string;
  subject: string;
  category: string;
  priority: "Low" | "Normal" | "High" | "Urgent";
  status: "Open" | "In Progress" | "Resolved";
  assigned_to?: number | null;
  assigned_name?: string | null;
  internal_notes?: string | null;
  created_at: string;
  updated_at?: string;
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
  pendingOrders: number;
  completedOrders: number;
  newQuotes: number;
  lowStockCount: number;
  customers: number;
  unreadMessages: number;
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

export * from "./permissions";
