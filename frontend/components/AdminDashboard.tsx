import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import {
  LayoutDashboard,
  Package,
  Layers,
  Boxes,
  ShoppingCart,
  FileText,
  Users,
  MessageSquare,
  HelpCircle,
  BarChart2,
  ScrollText,
  Settings,
  DollarSign,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Download,
  Plus,
  Pencil,
  Trash2,
  Mail,
  Clock,
  ArrowRight,
  Search,
  Filter,
  Check,
  Eye,
  RefreshCw,
  Phone,
  MapPin,
  ShieldCheck,
  TrendingUp,
  FileSpreadsheet,
  AlertCircle,
  Send,
  Building,
  Save,
} from "lucide-react";

import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { AdminSidebarLayout } from "@/frontend/components/AdminSidebarLayout";
import { StatusBadge } from "@/frontend/components/StatusBadge";
import { DataTable, type Column } from "@/frontend/components/DataTable";
import { OrderDrawer } from "@/frontend/components/OrderDrawer";
import { ProductDialog } from "@/frontend/components/ProductDialog";
import { ConfirmDialog } from "@/frontend/components/ConfirmDialog";
import { EmptyState } from "@/frontend/components/EmptyState";
import {
  CATEGORIES,
  ORDER_STATUSES,
  QUOTE_STATUSES,
  etb,
  type Category,
  type Product,
  type Order,
  type Quote,
  type OrderStatus,
  type QuoteStatus,
  type CustomerSummary,
} from "@/shared/data";
import { useStore, productsKey } from "@/frontend/store";
import {
  getAdminOverview,
  getOrdersPage,
  getProducts,
  getCustomers,
  getAdminData,
  saveProduct,
  deleteProduct,
  setOrderStatus,
  setQuoteStatus,
  updateProductStock,
  replyContactMessage,
  replySupportTicket,
  getAuditLogs,
  updateUserRole,
} from "@/backend/api.functions";

const PIE_COLORS = ["#0ea5e9", "#6366f1", "#10b981", "#f59e0b", "#f43f5e"];

// Seed data for features that expand beyond simple MySQL tables
interface ContactMessage {
  id: number;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  date: string;
  read: boolean;
  replied: boolean;
}

const INITIAL_MESSAGES: ContactMessage[] = [
  {
    id: 1,
    name: "Abebe Kebede",
    email: "abebe@construction-ethiopia.com",
    phone: "+251 911 234 567",
    subject: "Bulk inquiry for 10,000L Industrial Water Tanks",
    message: "Hello Polar Fiber team, we have an upcoming commercial project in Addis Ababa requiring six 10,000L heavy-duty fiberglass water storage tankers. Please provide bulk pricing and delivery lead times.",
    date: "2026-10-07",
    read: false,
    replied: false,
  },
  {
    id: 2,
    name: "Tigist Haile",
    email: "tigist.design@gmail.com",
    phone: "+251 922 456 789",
    subject: "Custom Architectural Planter Pots Catalog",
    message: "Do you offer custom RAL color coating for your fiberglass flower pots? We need 40 units in matte anthracite gray for a hotel terrace.",
    date: "2026-10-05",
    read: true,
    replied: true,
  },
  {
    id: 3,
    name: "Dr. Henok Tadesse",
    email: "henok@chem-industrial.et",
    phone: "+251 913 789 012",
    subject: "Chemical Resistance Specs for Sulfuric Acid Piping",
    message: "Could you send over the vinyl ester resin chemical compatibility charts for your fiber pipes? Operating temperature is around 65°C.",
    date: "2026-10-02",
    read: true,
    replied: false,
  },
];

interface SupportTicket {
  id: string;
  customer: string;
  subject: string;
  category: "Technical Specs" | "Installation" | "Warranty" | "Custom Fabrication";
  priority: "Urgent" | "High" | "Normal" | "Low";
  status: "Open" | "In Progress" | "Resolved";
  created_at: string;
}

const INITIAL_SUPPORT_TICKETS: SupportTicket[] = [
  {
    id: "TCK-1042",
    customer: "Awash Winery & Brewery",
    subject: "Underground installation guidelines for 15,000L tanker",
    category: "Installation",
    priority: "High",
    status: "Open",
    created_at: "2026-10-08",
  },
  {
    id: "TCK-1039",
    customer: "Bole Medhanealem Real Estate",
    subject: "Roof sheets UV warranty certificate request",
    category: "Warranty",
    priority: "Normal",
    status: "In Progress",
    created_at: "2026-10-06",
  },
  {
    id: "TCK-1025",
    customer: "Teklehaimanot Hospital",
    subject: "Acid neutralization chamber wall thickness verification",
    category: "Technical Specs",
    priority: "Urgent",
    status: "Resolved",
    created_at: "2026-09-28",
  },
];

interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  category: "Orders" | "Catalog" | "Quotes" | "Inventory" | "System";
  details: string;
}

const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "LOG-509",
    timestamp: "2026-10-08 10:15:22",
    actor: "Admin (Hussen)",
    action: "STOCK_UPDATE",
    category: "Inventory",
    details: "Restocked 50 units for 5,000L Vertical Water Tanker",
  },
  {
    id: "LOG-508",
    timestamp: "2026-10-08 09:30:10",
    actor: "Admin (Hussen)",
    action: "ORDER_STATUS_CHANGED",
    category: "Orders",
    details: "Order #1 status updated to Confirmed",
  },
  {
    id: "LOG-507",
    timestamp: "2026-10-07 16:45:00",
    actor: "Admin (Hussen)",
    action: "QUOTE_REPLY_SENT",
    category: "Quotes",
    details: "Sent quotation response to Abebe Kebede",
  },
  {
    id: "LOG-506",
    timestamp: "2026-10-06 14:20:15",
    actor: "System",
    action: "NEW_ORDER_RECEIVED",
    category: "Orders",
    details: "Customer completed checkout for Order #2",
  },
  {
    id: "LOG-505",
    timestamp: "2026-10-05 11:00:00",
    actor: "Admin (Hussen)",
    action: "PRODUCT_CREATED",
    category: "Catalog",
    details: "Added new catalog SKU: Heavy-Duty Ribbed Roof Sheet",
  },
];

export function AdminDashboard() {
  const { user } = useStore();
  const nav = useNavigate();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = React.useState("overview");

  // Orders State
  const [ordersPage, setOrdersPage] = React.useState(1);
  const [ordersPageSize] = React.useState(10);
  const [ordersSearch, setOrdersSearch] = React.useState("");
  const [ordersStatus, setOrdersStatus] = React.useState("all");
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
  const [orderDrawerOpen, setOrderDrawerOpen] = React.useState(false);
  const [statusUpdating, setStatusUpdating] = React.useState(false);

  // Products State
  const [productSearch, setProductSearch] = React.useState("");
  const [productCategoryFilter, setProductCategoryFilter] = React.useState("all");
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [productDialogOpen, setProductDialogOpen] = React.useState(false);
  const [deletingProduct, setDeletingProduct] = React.useState<Product | null>(null);
  const [confirmDeleteDialogOpen, setConfirmDeleteDialogOpen] = React.useState(false);
  const [savingProduct, setSavingProduct] = React.useState(false);

  // Quotes State
  const [selectedQuote, setSelectedQuote] = React.useState<Quote | null>(null);
  const [quoteFilter, setQuoteFilter] = React.useState("all");

  // Customers State
  const [customerSearch, setCustomerSearch] = React.useState("");

  // Inventory State
  const [inventorySearch, setInventorySearch] = React.useState("");
  const [stockUpdatingId, setStockUpdatingId] = React.useState<number | null>(null);

  // Messages State
  const [messages, setMessages] = React.useState<ContactMessage[]>(INITIAL_MESSAGES);
  const [selectedMessage, setSelectedMessage] = React.useState<ContactMessage | null>(null);
  const [messageSearch, setMessageSearch] = React.useState("");
  const [replyText, setReplyText] = React.useState("");

  // Support Tickets State
  const [tickets, setTickets] = React.useState<SupportTicket[]>(INITIAL_SUPPORT_TICKETS);
  const [ticketSearch, setTicketSearch] = React.useState("");
  const [ticketPriorityFilter, setTicketPriorityFilter] = React.useState("all");
  const [newTicketDialogOpen, setNewTicketDialogOpen] = React.useState(false);
  const [newTicketData, setNewTicketData] = React.useState({
    customer: "",
    subject: "",
    category: "Technical Specs" as SupportTicket["category"],
    priority: "Normal" as SupportTicket["priority"],
  });

  // Audit Logs State
  const [logs, setLogs] = React.useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [logCategoryFilter, setLogCategoryFilter] = React.useState("all");

  // Settings State
  const [settingsData, setSettingsData] = React.useState({
    companyName: "Polar Fiber Manufacturing PLC",
    supportEmail: "info@polarfiber.et",
    phone: "+251 911 234 567",
    address: "Bole Sub-City, Kebele 03, Addis Ababa, Ethiopia",
    currency: "ETB",
    vatRate: 15,
    emailOrderNotify: true,
    lowStockThreshold: 5,
  });

  // Server functions
  const fetchOverview = useServerFn(getAdminOverview);
  const fetchOrders = useServerFn(getOrdersPage);
  const fetchCatalog = useServerFn(getProducts);
  const fetchQuotesList = useServerFn(getAdminData);
  const fetchCustomerList = useServerFn(getCustomers);
  const mutateSaveProduct = useServerFn(saveProduct);
  const mutateDeleteProduct = useServerFn(deleteProduct);
  const mutateOrderStatus = useServerFn(setOrderStatus);
  const mutateQuoteStatus = useServerFn(setQuoteStatus);
  const mutateStock = useServerFn(updateProductStock);
  const mutateReplyMessage = useServerFn(replyContactMessage);
  const mutateReplyTicket = useServerFn(replySupportTicket);
  const fetchAuditLogs = useServerFn(getAuditLogs);
  const mutateUserRole = useServerFn(updateUserRole);

  const isStaffOrAdmin = user?.role === "admin" || user?.role === "staff";

  // Queries
  const auditLogsQuery = useQuery({
    queryKey: ["admin", "audit-logs"],
    queryFn: () => fetchAuditLogs(),
    enabled: isStaffOrAdmin && activeTab === "audit-logs",
  });

  const overviewQuery = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => fetchOverview(),
    enabled: isStaffOrAdmin,
  });

  const ordersQuery = useQuery({
    queryKey: ["admin", "orders", ordersPage, ordersSearch, ordersStatus],
    queryFn: () =>
      fetchOrders({
        data: {
          page: ordersPage,
          pageSize: ordersPageSize,
          search: ordersSearch,
          status: ordersStatus,
        },
      }),
    enabled: isStaffOrAdmin,
  });

  const productsQuery = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => fetchCatalog(),
    enabled: isStaffOrAdmin,
  });

  const adminDataQuery = useQuery({
    queryKey: ["admin", "data"],
    queryFn: () => fetchQuotesList(),
    enabled: isStaffOrAdmin,
  });

  const customersQuery = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: () => fetchCustomerList(),
    enabled: isStaffOrAdmin,
  });

  // Non-staff/admin guard
  if (!user || !isStaffOrAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-xs">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-foreground">Management Access Required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You must be logged in with a staff or administrator account to access this management dashboard.
        </p>
        <Button asChild className="mt-6 w-full bg-primary hover:bg-primary/90 text-primary-foreground">
          <Link to="/login">Sign In with Staff or Admin Account</Link>
        </Button>
      </div>
    );
  }

  // Calculations & KPIs
  const overview = overviewQuery.data;
  const kpis = overview?.kpis;
  const attention = overview?.attention;
  const allProducts = productsQuery.data ?? [];
  const allCustomers = customersQuery.data ?? [];
  const allOrders = ordersQuery.data?.orders ?? [];
  const allQuotes = adminDataQuery.data?.quotes ?? [];

  // Completed / delivered orders count & delivered revenue calculation
  const deliveredStatusPoint = overview?.statusDistribution?.find((s) => s.status === "Delivered");
  const completedOrdersCount = deliveredStatusPoint?.count ?? 0;
  const deliveredRevenue =
    allOrders.filter((o) => o.status === "Delivered").reduce((sum, o) => sum + o.total, 0) ||
    (kpis?.totalRevenue ?? 0);

  // Low stock items count
  const lowStockCount = allProducts.filter((p) => p.stock <= 5).length || (kpis?.lowStockCount ?? 0);

  // Unread messages count
  const unreadMessagesCount = messages.filter((m) => !m.read).length;

  // Recent Orders & Quotes
  const recentOrdersList = (attention?.pendingOrders.length ? attention.pendingOrders : allOrders).slice(0, 5);
  const recentQuotesList = (attention?.newQuotes.length ? attention.newQuotes : allQuotes).slice(0, 5);

  // Handlers
  const handleOrderStatusChange = async (orderId: number, newStatus: OrderStatus) => {
    setStatusUpdating(true);
    try {
      await mutateOrderStatus({ data: { id: orderId, status: newStatus } });
      toast.success(`Order #${orderId} status set to ${newStatus}`);
      if (selectedOrder && selectedOrder.order_id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
      setLogs((prev) => [
        {
          id: `LOG-${Date.now().toString().slice(-4)}`,
          timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
          actor: user.name,
          action: "ORDER_STATUS_CHANGED",
          category: "Orders",
          details: `Order #${orderId} marked as ${newStatus}`,
        },
        ...prev,
      ]);
      await qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      await qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update order status");
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleQuoteStatusChange = async (quoteId: number, newStatus: QuoteStatus) => {
    try {
      await mutateQuoteStatus({ data: { id: quoteId, status: newStatus } });
      toast.success(`Quote #${quoteId} status set to ${newStatus}`);
      if (selectedQuote && selectedQuote.quote_id === quoteId) {
        setSelectedQuote({ ...selectedQuote, status: newStatus });
      }
      setLogs((prev) => [
        {
          id: `LOG-${Date.now().toString().slice(-4)}`,
          timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
          actor: user.name,
          action: "QUOTE_STATUS_CHANGED",
          category: "Quotes",
          details: `Quote #${quoteId} status updated to ${newStatus}`,
        },
        ...prev,
      ]);
      await qc.invalidateQueries({ queryKey: ["admin", "data"] });
      await qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update quote status");
    }
  };

  const handleProductSave = async (prod: Product) => {
    setSavingProduct(true);
    try {
      await mutateSaveProduct({ data: prod });
      toast.success(prod.product_id ? "Product updated successfully" : "Product created successfully");
      setLogs((prev) => [
        {
          id: `LOG-${Date.now().toString().slice(-4)}`,
          timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
          actor: user.name,
          action: prod.product_id ? "PRODUCT_UPDATED" : "PRODUCT_CREATED",
          category: "Catalog",
          details: `${prod.name} (${prod.category})`,
        },
        ...prev,
      ]);
      await qc.invalidateQueries({ queryKey: ["admin", "products"] });
      await qc.invalidateQueries({ queryKey: productsKey });
      await qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSavingProduct(false);
    }
  };

  const handleProductDelete = async () => {
    if (!deletingProduct) return;
    try {
      await mutateDeleteProduct({ data: { id: deletingProduct.product_id } });
      toast.success(`Deleted ${deletingProduct.name}`);
      setLogs((prev) => [
        {
          id: `LOG-${Date.now().toString().slice(-4)}`,
          timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
          actor: user.name,
          action: "PRODUCT_DELETED",
          category: "Catalog",
          details: `Deleted ${deletingProduct.name}`,
        },
        ...prev,
      ]);
      await qc.invalidateQueries({ queryKey: ["admin", "products"] });
      await qc.invalidateQueries({ queryKey: productsKey });
      await qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete product");
    }
  };

  const handleQuickStockAdjust = async (product: Product, delta: number) => {
    const newStock = Math.max(0, product.stock + delta);
    setStockUpdatingId(product.product_id);
    try {
      await mutateStock({ data: { id: product.product_id, stock: newStock } });
      toast.success(`Stock for ${product.name} updated to ${newStock} units`);
      setLogs((prev) => [
        {
          id: `LOG-${Date.now().toString().slice(-4)}`,
          timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
          actor: user.name,
          action: "STOCK_ADJUSTMENT",
          category: "Inventory",
          details: `${product.name}: ${product.stock} -> ${newStock} units (${delta > 0 ? `+${delta}` : delta})`,
        },
        ...prev,
      ]);
      await qc.invalidateQueries({ queryKey: ["admin", "products"] });
      await qc.invalidateQueries({ queryKey: productsKey });
      await qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to adjust stock");
    } finally {
      setStockUpdatingId(null);
    }
  };

  // CSV Export for orders
  const exportOrdersCSV = () => {
    const orders = ordersQuery.data?.orders ?? [];
    if (!orders.length) {
      toast.error("No orders available to export.");
      return;
    }
    const headers = ["Order ID", "Customer", "Date", "Status", "Address", "Items Summary", "Total (ETB)"];
    const rows = orders.map((o) => [
      o.order_id,
      `"${(o.customer ?? "Guest").replace(/"/g, '""')}"`,
      o.created_at,
      o.status,
      `"${o.address.replace(/"/g, '""')}"`,
      `"${o.items.map((i) => `${i.quantity}x ${i.product_name}`).join("; ").replace(/"/g, '""')}"`,
      o.total,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `polarfiber_orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Orders exported to CSV");
  };

  // Filtering products
  const filteredProducts = allProducts.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.description.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCategory = productCategoryFilter === "all" || p.category === productCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filtering inventory
  const filteredInventory = allProducts.filter((p) => {
    return (
      p.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      p.category.toLowerCase().includes(inventorySearch.toLowerCase())
    );
  });

  // Total inventory metrics
  const totalStockUnits = allProducts.reduce((sum, p) => sum + p.stock, 0);
  const totalStockValue = allProducts.reduce((sum, p) => sum + p.stock * p.price, 0);
  const outOfStockCount = allProducts.filter((p) => p.stock === 0).length;

  // Filtering quotes
  const filteredQuotes = allQuotes.filter((q) => {
    return quoteFilter === "all" || q.status === quoteFilter;
  });

  // Filtering customers
  const filteredCustomers = allCustomers.filter((c) => {
    return (
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch)
    );
  });

  // Filtering messages
  const filteredMessages = messages.filter((m) => {
    return (
      m.name.toLowerCase().includes(messageSearch.toLowerCase()) ||
      m.subject.toLowerCase().includes(messageSearch.toLowerCase()) ||
      m.message.toLowerCase().includes(messageSearch.toLowerCase())
    );
  });

  // Filtering tickets
  const filteredTickets = tickets.filter((t) => {
    const matchesQuery =
      t.customer.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.subject.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.id.toLowerCase().includes(ticketSearch.toLowerCase());
    const matchesPriority = ticketPriorityFilter === "all" || t.priority === ticketPriorityFilter;
    return matchesQuery && matchesPriority;
  });

  // Filtering audit logs
  const combinedLogs: AuditLogEntry[] = React.useMemo(() => {
    if (!auditLogsQuery.data || !auditLogsQuery.data.length) return logs;
    const dbLogs: AuditLogEntry[] = auditLogsQuery.data.map((l) => ({
      id: `LOG-${l.id}`,
      timestamp: String(l.created_at || ""),
      actor: l.actor_name || "Admin",
      action: l.action,
      category: (l.entity_type === "order"
        ? "Orders"
        : l.entity_type === "product"
          ? "Catalog"
          : l.entity_type === "quote"
            ? "Quotes"
            : "System") as AuditLogEntry["category"],
      details: `${l.action} on ${l.entity_type} #${l.entity_id}`,
    }));
    return [...dbLogs, ...logs];
  }, [auditLogsQuery.data, logs]);

  const filteredLogs = combinedLogs.filter((l) => {
    return logCategoryFilter === "all" || l.category === logCategoryFilter;
  });

  // Badges to display on sidebar
  const sidebarBadges = {
    orders: kpis?.totalOrders ? String(kpis.totalOrders) : undefined,
    quotes: attention?.newQuotes.length ? String(attention.newQuotes.length) : undefined,
    inventory: lowStockCount > 0 ? `${lowStockCount} low` : undefined,
    messages: unreadMessagesCount > 0 ? String(unreadMessagesCount) : undefined,
  };

  return (
    <AdminSidebarLayout activeTab={activeTab} onTabChange={setActiveTab} badges={sidebarBadges}>
      {/* ======================================================== */}
      {/* 1. OVERVIEW TAB (Exact match to requested visual design)  */}
      {/* ======================================================== */}
      {activeTab === "overview" && (
        <div className="space-y-7 animate-in fade-in-50 duration-200">
          {/* Header Title & Subtitle */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard Overview</h1>
            <p className="text-sm text-muted-foreground mt-1">Monitor your business at a glance</p>
          </div>

          {/* 8 Stat Cards in 4x2 Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
            {/* 1. Total Orders */}
            <div
              onClick={() => setActiveTab("orders")}
              className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
            >
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Total Orders</p>
                <p className="text-3xl font-bold text-foreground mt-1.5">{kpis?.totalOrders ?? 0}</p>
              </div>
              <div className="h-13 w-13 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                <ShoppingCart className="h-6 w-6 stroke-[2]" />
              </div>
            </div>

            {/* 2. Pending Orders */}
            <div
              onClick={() => {
                setOrdersStatus("Pending");
                setActiveTab("orders");
              }}
              className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
            >
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Pending Orders</p>
                <p className="text-3xl font-bold text-foreground mt-1.5">
                  {attention?.pendingOrders.length ?? 0}
                </p>
              </div>
              <div className="h-13 w-13 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 group-hover:scale-105 transition-transform">
                <Package className="h-6 w-6 stroke-[2]" />
              </div>
            </div>

            {/* 3. Revenue (Delivered) */}
            <div className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Revenue (Delivered)</p>
                <p className="text-2xl font-bold text-foreground mt-1.5">
                  {etb(deliveredRevenue)}
                </p>
              </div>
              <div className="h-13 w-13 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:scale-105 transition-transform">
                <DollarSign className="h-6 w-6 stroke-[2.2]" />
              </div>
            </div>

            {/* 4. Pending Quotes */}
            <div
              onClick={() => {
                setQuoteFilter("New");
                setActiveTab("quotes");
              }}
              className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
            >
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Pending Quotes</p>
                <p className="text-3xl font-bold text-foreground mt-1.5">
                  {attention?.newQuotes.length ?? 0}
                </p>
              </div>
              <div className="h-13 w-13 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-500 group-hover:scale-105 transition-transform">
                <FileText className="h-6 w-6 stroke-[2]" />
              </div>
            </div>

            {/* 5. Customers */}
            <div
              onClick={() => setActiveTab("customers")}
              className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
            >
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Customers</p>
                <p className="text-3xl font-bold text-foreground mt-1.5">{allCustomers.length}</p>
              </div>
              <div className="h-13 w-13 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:scale-105 transition-transform">
                <Users className="h-6 w-6 stroke-[2]" />
              </div>
            </div>

            {/* 6. Low Stock */}
            <div
              onClick={() => setActiveTab("inventory")}
              className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
            >
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Low Stock</p>
                <p className="text-3xl font-bold text-foreground mt-1.5">{lowStockCount}</p>
              </div>
              <div className="h-13 w-13 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 group-hover:scale-105 transition-transform">
                <AlertTriangle className="h-6 w-6 stroke-[2]" />
              </div>
            </div>

            {/* 7. New Messages */}
            <div
              onClick={() => setActiveTab("messages")}
              className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
            >
              <div>
                <p className="text-xs font-semibold text-muted-foreground">New Messages</p>
                <p className="text-3xl font-bold text-foreground mt-1.5">{unreadMessagesCount}</p>
              </div>
              <div className="h-13 w-13 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-500 group-hover:scale-105 transition-transform">
                <Bell className="h-6 w-6 stroke-[2]" />
              </div>
            </div>

            {/* 8. Completed Orders */}
            <div
              onClick={() => {
                setOrdersStatus("Delivered");
                setActiveTab("orders");
              }}
              className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
            >
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Completed Orders</p>
                <p className="text-3xl font-bold text-foreground mt-1.5">{completedOrdersCount}</p>
              </div>
              <div className="h-13 w-13 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:scale-105 transition-transform">
                <CheckCircle2 className="h-6 w-6 stroke-[2]" />
              </div>
            </div>
          </div>

          {/* Lower 2 Cards: Recent Orders & Recent Quotes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Orders Card */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <h2 className="text-base font-bold text-foreground">Recent Orders</h2>
                  {recentOrdersList.length > 0 && (
                    <button
                      onClick={() => setActiveTab("orders")}
                      className="text-xs font-semibold text-primary hover:text-primary/80 cursor-pointer"
                    >
                      View all
                    </button>
                  )}
                </div>

                <div className="pt-4">
                  {recentOrdersList.length === 0 ? (
                    <div className="py-12 text-muted-foreground/60 text-sm font-normal">
                      No orders yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {recentOrdersList.map((ord) => (
                        <div
                          key={ord.order_id}
                          onClick={() => {
                            setSelectedOrder(ord);
                            setOrderDrawerOpen(true);
                          }}
                          className="py-3 flex items-center justify-between hover:bg-muted/50 px-2 rounded-xl transition-colors cursor-pointer"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-foreground">
                                Order #{ord.order_id}
                              </span>
                              <StatusBadge s={ord.status} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{ord.customer ?? "Guest"}</p>
                          </div>
                          <span className="text-sm font-bold text-primary">{etb(ord.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {recentOrdersList.length === 0 && (
                <div className="pt-4 border-t border-border/40 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab("orders")}
                    className="text-xs text-muted-foreground"
                  >
                    Open Orders Manager
                  </Button>
                </div>
              )}
            </div>

            {/* Recent Quotes Card */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <h2 className="text-base font-bold text-foreground">Recent Quotes</h2>
                  {recentQuotesList.length > 0 && (
                    <button
                      onClick={() => setActiveTab("quotes")}
                      className="text-xs font-semibold text-primary hover:text-primary/80 cursor-pointer"
                    >
                      View all
                    </button>
                  )}
                </div>

                <div className="pt-4">
                  {recentQuotesList.length === 0 ? (
                    <div className="py-12 text-muted-foreground/60 text-sm font-normal">
                      No quotes yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {recentQuotesList.map((q) => (
                        <div
                          key={q.quote_id}
                          onClick={() => {
                            setSelectedQuote(q);
                            setActiveTab("quotes");
                          }}
                          className="py-3 flex items-center justify-between hover:bg-muted/50 px-2 rounded-xl transition-colors cursor-pointer"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-foreground truncate">
                                {q.subject}
                              </span>
                              <StatusBadge s={q.status} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {q.name} · {q.created_at}
                            </p>
                          </div>
                          <Button size="sm" variant="ghost" className="text-xs text-primary shrink-0">
                            Inspect
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {recentQuotesList.length === 0 && (
                <div className="pt-4 border-t border-border/40 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab("quotes")}
                    className="text-xs text-muted-foreground"
                  >
                    Open Quotes Manager
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. PRODUCTS TAB (Complete Catalog Management)           */}
      {/* ======================================================== */}
      {activeTab === "products" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Products Catalog</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage fiberglass listings, technical specs, and prices</p>
            </div>
            <Button
              onClick={() => {
                setEditingProduct(null);
                setProductDialogOpen(true);
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                placeholder="Search products by name or description..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9 bg-card border-border"
              />
            </div>
            <select
              value={productCategoryFilter}
              onChange={(e) => setProductCategoryFilter(e.target.value)}
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-4">Product Details</th>
                    <th className="px-5 py-4">Category</th>
                    <th className="px-5 py-4">Capacity</th>
                    <th className="px-5 py-4">Price</th>
                    <th className="px-5 py-4">Stock</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground/60 text-sm">
                        No products match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isLow = p.stock <= 5;
                      return (
                        <tr key={p.product_id} className="hover:bg-muted/50/60 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3.5">
                              {p.image ? (
                                <img
                                  src={p.image}
                                  alt={p.name}
                                  className="h-11 w-11 rounded-xl object-cover border border-border"
                                />
                              ) : (
                                <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center text-muted-foreground/60">
                                  <Package className="h-5 w-5" />
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-foreground">{p.name}</p>
                                <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{p.description}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-muted-foreground font-medium">{p.category}</td>
                          <td className="px-5 py-4 text-muted-foreground">{p.capacity || "—"}</td>
                          <td className="px-5 py-4 font-bold text-primary">{etb(p.price)}</td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                isLow
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              {isLow && <AlertTriangle className="h-3 w-3" />}
                              {p.stock} in stock
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingProduct(p);
                                  setProductDialogOpen(true);
                                }}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setDeletingProduct(p);
                                  setConfirmDeleteDialogOpen(true);
                                }}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. CATEGORIES TAB                                       */}
      {/* ======================================================== */}
      {activeTab === "categories" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Product Categories</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage fiberglass manufacturing lines and taxonomy</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {CATEGORIES.map((catName) => {
              const catProds = allProducts.filter((p) => p.category === catName);
              const catStock = catProds.reduce((sum, p) => sum + p.stock, 0);

              return (
                <div
                  key={catName}
                  className="bg-card border border-border rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div>
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                      <Layers className="h-6 w-6" />
                    </div>
                    <h3 className="font-bold text-base text-foreground">{catName}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Reinforced structural composite manufacturing specifications for Ethiopian industrial and domestic sectors.
                    </p>
                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">Listed Products:</span>
                      <span className="text-foreground">{catProds.length} SKUs</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">Warehouse Units:</span>
                      <span className="text-primary">{catStock} units</span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setProductCategoryFilter(catName);
                      setActiveTab("products");
                    }}
                    className="mt-5 w-full text-xs font-semibold text-primary border-primary/20 hover:bg-primary/10"
                  >
                    View Products in {catName}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. INVENTORY TAB                                        */}
      {/* ======================================================== */}
      {activeTab === "inventory" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Inventory Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Track warehouse stock levels, low-stock alerts, and fast adjustments</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
              <p className="text-xs font-semibold text-muted-foreground">Total Catalog SKUs</p>
              <p className="text-3xl font-bold text-foreground mt-1.5">{allProducts.length}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
              <p className="text-xs font-semibold text-muted-foreground">Total Units In Stock</p>
              <p className="text-3xl font-bold text-primary mt-1.5">{totalStockUnits}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
              <p className="text-xs font-semibold text-muted-foreground">Low Stock Warnings</p>
              <p className="text-3xl font-bold text-amber-500 mt-1.5">{lowStockCount}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
              <p className="text-xs font-semibold text-muted-foreground">Stock Inventory Value</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1.5">{etb(totalStockValue)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                placeholder="Filter by product name..."
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                className="pl-9 bg-card border-border"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-4">Item</th>
                    <th className="px-5 py-4">Category</th>
                    <th className="px-5 py-4">Current Stock</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Quick Restock / Adjust</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredInventory.map((p) => {
                    const isUpdating = stockUpdatingId === p.product_id;
                    const isLow = p.stock <= 5;
                    const isOut = p.stock === 0;

                    return (
                      <tr key={p.product_id} className="hover:bg-muted/50/60 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground/60">Unit Price: {etb(p.price)}</p>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">{p.category}</td>
                        <td className="px-5 py-4 font-bold text-base text-foreground">{p.stock} units</td>
                        <td className="px-5 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              isOut
                                ? "bg-rose-100 text-rose-800"
                                : isLow
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {isOut ? "Out of Stock" : isLow ? "Low Stock" : "Well Stocked"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isUpdating || p.stock === 0}
                              onClick={() => handleQuickStockAdjust(p, -1)}
                              className="h-8 px-2 text-xs"
                            >
                              -1
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isUpdating}
                              onClick={() => handleQuickStockAdjust(p, 1)}
                              className="h-8 px-2 text-xs font-semibold text-primary"
                            >
                              +1
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isUpdating}
                              onClick={() => handleQuickStockAdjust(p, 5)}
                              className="h-8 px-2 text-xs font-semibold text-emerald-600"
                            >
                              +5
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isUpdating}
                              onClick={() => handleQuickStockAdjust(p, 10)}
                              className="h-8 px-2 text-xs font-semibold text-indigo-600"
                            >
                              +10
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. ORDERS TAB                                           */}
      {/* ======================================================== */}
      {activeTab === "orders" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Order Management</h1>
              <p className="text-sm text-muted-foreground mt-1">Track customer orders, manage statuses, and export fulfillment records</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={exportOrdersCSV}
              className="gap-2 text-muted-foreground bg-card"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                placeholder="Search order #, customer, address..."
                value={ordersSearch}
                onChange={(e) => {
                  setOrdersSearch(e.target.value);
                  setOrdersPage(1);
                }}
                className="pl-9 bg-card border-border"
              />
            </div>
            <select
              value={ordersStatus}
              onChange={(e) => {
                setOrdersStatus(e.target.value);
                setOrdersPage(1);
              }}
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground"
            >
              <option value="all">All Statuses</option>
              {ORDER_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-4">Order #</th>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Items Summary</th>
                    <th className="px-5 py-4">Total</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground/60 text-sm">
                        No orders found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    allOrders.map((o) => (
                      <tr
                        key={o.order_id}
                        onClick={() => {
                          setSelectedOrder(o);
                          setOrderDrawerOpen(true);
                        }}
                        className="hover:bg-muted/50/60 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-4 font-bold text-foreground">#{o.order_id}</td>
                        <td className="px-5 py-4 font-semibold text-foreground">{o.customer ?? "Guest"}</td>
                        <td className="px-5 py-4 text-muted-foreground text-xs">{o.created_at}</td>
                        <td className="px-5 py-4 text-xs text-muted-foreground max-w-xs truncate">
                          {o.items.map((i) => `${i.quantity}x ${i.product_name}`).join(", ")}
                        </td>
                        <td className="px-5 py-4 font-bold text-primary">{etb(o.total)}</td>
                        <td className="px-5 py-4">
                          <StatusBadge s={o.status} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Button size="sm" variant="ghost" className="text-xs text-primary font-semibold">
                            Manage
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. QUOTES TAB                                           */}
      {/* ======================================================== */}
      {activeTab === "quotes" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Customer Quote Requests</h1>
            <p className="text-sm text-muted-foreground mt-1">Review technical requests, send pricing quotations, and communicate with clients</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={quoteFilter}
              onChange={(e) => setQuoteFilter(e.target.value)}
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground"
            >
              <option value="all">All Quote Statuses</option>
              {QUOTE_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Inbox */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Inquiries Inbox ({filteredQuotes.length})
              </h3>
              <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                {filteredQuotes.length === 0 ? (
                  <p className="p-8 text-center text-xs text-muted-foreground/60">No quote requests found.</p>
                ) : (
                  filteredQuotes.map((q) => {
                    const isSelected = selectedQuote?.quote_id === q.quote_id;
                    const isNew = q.status === "New";
                    return (
                      <div
                        key={q.quote_id}
                        onClick={() => setSelectedQuote(q)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-xs"
                            : isNew
                              ? "border-amber-200 bg-amber-50/40 hover:bg-muted/50"
                              : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm text-foreground truncate">{q.subject}</p>
                          <StatusBadge s={q.status} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground truncate">{q.name} · {q.created_at}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Viewer */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-xs lg:col-span-2">
              {selectedQuote ? (
                <div className="space-y-6 flex flex-col justify-between h-full">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-4">
                      <div>
                        <span className="text-xs text-muted-foreground/60">Inquiry #{selectedQuote.quote_id}</span>
                        <h2 className="text-lg font-bold text-foreground mt-0.5">{selectedQuote.subject}</h2>
                      </div>
                      <StatusBadge s={selectedQuote.status} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-muted/50 p-4 text-xs">
                      <div>
                        <span className="text-muted-foreground/60">Customer Name:</span>
                        <p className="font-semibold text-foreground text-sm mt-0.5">{selectedQuote.name}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground/60">Email:</span>
                        <p className="font-semibold text-primary text-sm mt-0.5">{selectedQuote.email}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground/60">Submission Date:</span>
                        <p className="font-semibold text-foreground mt-0.5">{selectedQuote.created_at}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Client Message / Requirements
                      </h4>
                      <div className="mt-2 rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                        {selectedQuote.message}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                      <a href={`mailto:${selectedQuote.email}?subject=RE: ${encodeURIComponent(selectedQuote.subject)}`}>
                        <Mail className="h-4 w-4" />
                        Reply by Email
                      </a>
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuoteStatusChange(selectedQuote.quote_id, "Replied")}
                        disabled={selectedQuote.status === "Replied"}
                      >
                        Mark Replied
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleQuoteStatusChange(selectedQuote.quote_id, "Closed")}
                        disabled={selectedQuote.status === "Closed"}
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No quote selected"
                  description="Select a quote request from the left inbox to view full message content and reply."
                  className="border-none py-20"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. CUSTOMERS TAB                                        */}
      {/* ======================================================== */}
      {activeTab === "customers" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Customer Directory</h1>
            <p className="text-sm text-muted-foreground mt-1">Review registered client accounts, order counts, and lifetime spending</p>
          </div>

          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input
              placeholder="Search by customer name, email..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-4">Customer Name</th>
                    <th className="px-5 py-4">Email</th>
                    <th className="px-5 py-4">Phone</th>
                    <th className="px-5 py-4">Role</th>
                    <th className="px-5 py-4">Orders Placed</th>
                    <th className="px-5 py-4">Lifetime Spend</th>
                    <th className="px-5 py-4">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground/60 text-sm">
                        No customer accounts found.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => (
                      <tr key={c.user_id} className="hover:bg-muted/50/60 transition-colors">
                        <td className="px-5 py-4 font-semibold text-foreground">{c.name}</td>
                        <td className="px-5 py-4 text-muted-foreground">{c.email}</td>
                        <td className="px-5 py-4 text-muted-foreground">{c.phone || "—"}</td>
                        <td className="px-5 py-4">
                          {user?.role === "admin" ? (
                            <select
                              value={c.role}
                              onChange={async (e) => {
                                const newRole = e.target.value as "customer" | "admin" | "staff";
                                try {
                                  await mutateUserRole({
                                    data: { userId: c.user_id, role: newRole },
                                  });
                                  toast.success(`Updated ${c.name}'s role to ${newRole}`);
                                  customersQuery.refetch();
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : "Failed to update role");
                                }
                              }}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize border border-border bg-card cursor-pointer focus:ring-1 focus:ring-primary ${
                                c.role === "admin"
                                  ? "text-primary border-primary/30"
                                  : c.role === "staff"
                                    ? "text-amber-600 border-amber-500/30 dark:text-amber-400"
                                    : "text-muted-foreground"
                              }`}
                            >
                              <option value="customer">Customer</option>
                              <option value="staff">Staff</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                                c.role === "admin"
                                  ? "bg-primary/15 text-primary"
                                  : c.role === "staff"
                                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {c.role}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 font-semibold text-foreground">{c.orders_count}</td>
                        <td className="px-5 py-4 font-bold text-primary">{etb(c.total_spent)}</td>
                        <td className="px-5 py-4 text-xs text-muted-foreground/60">{c.created_at}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. MESSAGES TAB                                         */}
      {/* ======================================================== */}
      {activeTab === "messages" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Inbound Messages</h1>
            <p className="text-sm text-muted-foreground mt-1">Direct inquiries, feedback, and questions from website visitors</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <Input
                  placeholder="Search messages..."
                  value={messageSearch}
                  onChange={(e) => setMessageSearch(e.target.value)}
                  className="pl-8 text-xs bg-muted/50 border-border h-8"
                />
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {filteredMessages.map((m) => {
                  const isSelected = selectedMessage?.id === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        setSelectedMessage(m);
                        if (!m.read) {
                          setMessages((prev) =>
                            prev.map((item) => (item.id === m.id ? { ...item, read: true } : item)),
                          );
                        }
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : !m.read
                            ? "border-primary/20 bg-primary/10/30 font-semibold"
                            : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-foreground truncate">{m.name}</p>
                        {!m.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{m.subject}</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-1">{m.date}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 shadow-xs lg:col-span-2">
              {selectedMessage ? (
                <div className="space-y-6">
                  <div className="border-b border-border pb-4">
                    <h2 className="text-lg font-bold text-foreground">{selectedMessage.subject}</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      From: <strong className="text-foreground">{selectedMessage.name}</strong> ({selectedMessage.email}) · {selectedMessage.phone}
                    </p>
                  </div>

                  <div className="rounded-xl bg-muted/50 p-5 text-sm text-foreground leading-relaxed">
                    {selectedMessage.message}
                  </div>

                  <div className="space-y-3 pt-2">
                    <Label className="text-xs font-semibold text-muted-foreground">Quick Reply</Label>
                    <textarea
                      rows={4}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your response to the customer..."
                      className="w-full rounded-xl border border-border p-3 text-sm focus:outline-sky-500"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={async () => {
                          if (!replyText.trim()) {
                            toast.error("Please enter a reply message.");
                            return;
                          }
                          const msg = replyText.trim();
                          setReplyText("");
                          await mutateReplyMessage({
                            data: {
                              quote_id: selectedMessage.id,
                              email: selectedMessage.email,
                              message: msg,
                            },
                          }).catch(() => {});
                          toast.success(`Reply sent to ${selectedMessage.email}`);
                          setMessages((prev) =>
                            prev.map((item) =>
                              item.id === selectedMessage.id ? { ...item, replied: true } : item,
                            ),
                          );
                        }}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                      >
                        <Send className="h-4 w-4" />
                        Send Reply
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={MessageSquare}
                  title="No message selected"
                  description="Choose an inquiry from the inbox to read and respond."
                  className="border-none py-20"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 9. SUPPORT TAB                                          */}
      {/* ======================================================== */}
      {activeTab === "support" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Technical Support Queue</h1>
              <p className="text-sm text-muted-foreground mt-1">Engineering support, installation inquiries, and warranty tickets</p>
            </div>
            <Button
              onClick={() => setNewTicketDialogOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              <Plus className="h-4 w-4" />
              New Ticket
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                placeholder="Search ticket ID or client..."
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                className="pl-9 bg-card border-border"
              />
            </div>
            <select
              value={ticketPriorityFilter}
              onChange={(e) => setTicketPriorityFilter(e.target.value)}
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground"
            >
              <option value="all">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Normal">Normal</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-4">Ticket</th>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Subject</th>
                    <th className="px-5 py-4">Category</th>
                    <th className="px-5 py-4">Priority</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTickets.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/50/60 transition-colors">
                      <td className="px-5 py-4 font-bold text-primary">{t.id}</td>
                      <td className="px-5 py-4 font-semibold text-foreground">{t.customer}</td>
                      <td className="px-5 py-4 text-foreground">{t.subject}</td>
                      <td className="px-5 py-4 text-xs text-muted-foreground">{t.category}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            t.priority === "Urgent"
                              ? "bg-rose-100 text-rose-700"
                              : t.priority === "High"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            t.status === "Resolved"
                              ? "bg-emerald-100 text-emerald-800"
                              : t.status === "In Progress"
                                ? "bg-primary/15 text-primary"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const newStatus = t.status === "Resolved" ? "In Progress" : "Resolved";
                            setTickets((prev) =>
                              prev.map((item) =>
                                item.id === t.id
                                  ? {
                                      ...item,
                                      status: newStatus,
                                    }
                                  : item,
                              ),
                            );
                            await mutateReplyTicket({
                              data: {
                                ticket_id: t.id,
                                customer_email: t.customer.includes("@") ? t.customer : undefined,
                                reply: `Ticket status updated to ${newStatus}`,
                              },
                            }).catch(() => {});
                            toast.success(`Ticket ${t.id} updated`);
                          }}
                          className="text-xs"
                        >
                          {t.status === "Resolved" ? "Reopen" : "Mark Resolved"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 10. REPORTS TAB                                         */}
      {/* ======================================================== */}
      {activeTab === "reports" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics & Sales Reports</h1>
            <p className="text-sm text-muted-foreground mt-1">Financial performance, daily volume, and catalog category revenue</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Orders Timeline Chart */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-xs lg:col-span-2">
              <h3 className="text-base font-bold text-foreground">30-Day Order Volume Trend</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Daily orders placed across Ethiopia</p>
              <div className="mt-6 h-64 w-full">
                {overview?.timeline && overview.timeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={overview.timeline}>
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2.5} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground/60">
                    No order activity in the last 30 days.
                  </div>
                )}
              </div>
            </div>

            {/* Order Status Distribution */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-xs">
              <h3 className="text-base font-bold text-foreground">Order Status Distribution</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Breakdown of orders</p>
              <div className="mt-6 h-64 w-full">
                {overview?.statusDistribution && overview.statusDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={overview.statusDistribution}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                      >
                        {overview.statusDistribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground/60">
                    No order status data.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Revenue by category */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xs">
            <h3 className="text-base font-bold text-foreground">Revenue by Category (ETB)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Total sales generated per fiberglass product line</p>
            <div className="mt-6 h-64 w-full">
              {overview?.categoryRevenue && overview.categoryRevenue.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.categoryRevenue}>
                    <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip formatter={(val) => [etb(Number(val)), "Revenue"]} />
                    <Bar dataKey="revenue" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground/60">
                  No sales recorded by category yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 11. AUDIT LOGS TAB                                      */}
      {/* ======================================================== */}
      {activeTab === "audit-logs" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">System Audit Logs</h1>
              <p className="text-sm text-muted-foreground mt-1">Security traceability, catalog changes, and administrative actions</p>
            </div>
            <select
              value={logCategoryFilter}
              onChange={(e) => setLogCategoryFilter(e.target.value)}
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground"
            >
              <option value="all">All Event Categories</option>
              <option value="Orders">Orders</option>
              <option value="Catalog">Catalog</option>
              <option value="Inventory">Inventory</option>
              <option value="Quotes">Quotes</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-4">Timestamp</th>
                    <th className="px-5 py-4">Actor</th>
                    <th className="px-5 py-4">Action</th>
                    <th className="px-5 py-4">Category</th>
                    <th className="px-5 py-4">Event Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/50/60 transition-colors">
                      <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{log.timestamp}</td>
                      <td className="px-5 py-4 font-semibold text-foreground">{log.actor}</td>
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-md">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-muted-foreground">{log.category}</td>
                      <td className="px-5 py-4 text-foreground">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 12. SETTINGS TAB                                        */}
      {/* ======================================================== */}
      {activeTab === "settings" && (
        <div className="space-y-6 max-w-3xl animate-in fade-in-50 duration-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin & Business Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">Configure company details, Ethiopian Birr localization, and alert rules</p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-6">
            <h3 className="font-bold text-base text-foreground border-b border-border pb-3">
              Company & Factory Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Company Name</Label>
                <Input
                  value={settingsData.companyName}
                  onChange={(e) => setSettingsData({ ...settingsData, companyName: e.target.value })}
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Support Email</Label>
                <Input
                  value={settingsData.supportEmail}
                  onChange={(e) => setSettingsData({ ...settingsData, supportEmail: e.target.value })}
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Contact Phone</Label>
                <Input
                  value={settingsData.phone}
                  onChange={(e) => setSettingsData({ ...settingsData, phone: e.target.value })}
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Default Currency</Label>
                <Input value={settingsData.currency} disabled className="bg-muted text-muted-foreground" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Physical Address</Label>
                <Input
                  value={settingsData.address}
                  onChange={(e) => setSettingsData({ ...settingsData, address: e.target.value })}
                  className="bg-muted/50"
                />
              </div>
            </div>

            <h3 className="font-bold text-base text-foreground border-b border-border pb-3 pt-2">
              Notifications & Inventory Alerts
            </h3>

            <div className="space-y-4 text-sm">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsData.emailOrderNotify}
                  onChange={(e) =>
                    setSettingsData({ ...settingsData, emailOrderNotify: e.target.checked })
                  }
                  className="h-4 w-4 rounded text-primary focus:ring-sky-500"
                />
                <span className="text-muted-foreground font-medium">Send email notification when an order is submitted</span>
              </label>

              <div className="flex items-center justify-between max-w-sm pt-2">
                <span className="text-muted-foreground font-medium">Low stock warning threshold:</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={settingsData.lowStockThreshold}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        lowStockThreshold: Number(e.target.value) || 5,
                      })
                    }
                    className="w-20 text-center h-8"
                  />
                  <span className="text-xs text-muted-foreground">units</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <Button
                onClick={() => {
                  toast.success("Settings saved successfully!");
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                <Save className="h-4 w-4" />
                Save Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODALS & DRAWERS                                         */}
      {/* ======================================================== */}

      {/* Order Details Drawer */}
      <OrderDrawer
        order={selectedOrder}
        open={orderDrawerOpen}
        onOpenChange={setOrderDrawerOpen}
        mode="admin"
        onStatusChange={handleOrderStatusChange}
        statusUpdating={statusUpdating}
      />

      {/* Product Add/Edit Dialog */}
      <ProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={editingProduct}
        onSave={handleProductSave}
        loading={savingProduct}
      />

      {/* Delete Product Confirmation */}
      <ConfirmDialog
        open={confirmDeleteDialogOpen}
        onOpenChange={setConfirmDeleteDialogOpen}
        title={`Delete "${deletingProduct?.name}"?`}
        description="Are you sure you want to remove this product from the catalog? This action cannot be undone."
        confirmLabel="Delete Product"
        variant="destructive"
        onConfirm={handleProductDelete}
      />

      {/* New Support Ticket Dialog */}
      {newTicketDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-foreground">Create Support Ticket</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Client Name</Label>
                <Input
                  value={newTicketData.customer}
                  onChange={(e) => setNewTicketData({ ...newTicketData, customer: e.target.value })}
                  placeholder="e.g. BGI Ethiopia"
                />
              </div>
              <div>
                <Label className="text-xs">Issue Subject</Label>
                <Input
                  value={newTicketData.subject}
                  onChange={(e) => setNewTicketData({ ...newTicketData, subject: e.target.value })}
                  placeholder="e.g. Tank nozzle flange replacement"
                />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <select
                  value={newTicketData.category}
                  onChange={(e) =>
                    setNewTicketData({
                      ...newTicketData,
                      category: e.target.value as SupportTicket["category"],
                    })
                  }
                  className="w-full h-10 rounded-lg border border-border px-3 text-sm"
                >
                  <option value="Technical Specs">Technical Specs</option>
                  <option value="Installation">Installation</option>
                  <option value="Warranty">Warranty</option>
                  <option value="Custom Fabrication">Custom Fabrication</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Priority</Label>
                <select
                  value={newTicketData.priority}
                  onChange={(e) =>
                    setNewTicketData({
                      ...newTicketData,
                      priority: e.target.value as SupportTicket["priority"],
                    })
                  }
                  className="w-full h-10 rounded-lg border border-border px-3 text-sm"
                >
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setNewTicketDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!newTicketData.customer || !newTicketData.subject) {
                    toast.error("Please fill in client name and subject.");
                    return;
                  }
                  const newTicket: SupportTicket = {
                    id: `TCK-${Math.floor(1000 + Math.random() * 9000)}`,
                    customer: newTicketData.customer,
                    subject: newTicketData.subject,
                    category: newTicketData.category,
                    priority: newTicketData.priority,
                    status: "Open",
                    created_at: new Date().toISOString().slice(0, 10),
                  };
                  setTickets([newTicket, ...tickets]);
                  toast.success(`Support ticket ${newTicket.id} created`);
                  setNewTicketDialogOpen(false);
                  setNewTicketData({
                    customer: "",
                    subject: "",
                    category: "Technical Specs",
                    priority: "Normal",
                  });
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminSidebarLayout>
  );
}
