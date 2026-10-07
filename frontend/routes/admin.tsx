import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  ShoppingBag,
  Package,
  MessageSquare,
  Users,
  DollarSign,
  AlertTriangle,
  Download,
  Plus,
  Pencil,
  Trash2,
  Mail,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  Search,
  Filter,
  Layers,
} from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { DashboardLayout } from "@/frontend/components/DashboardLayout";
import { StatCard } from "@/frontend/components/StatCard";
import { StatusBadge } from "@/frontend/components/StatusBadge";
import { DataTable, type Column } from "@/frontend/components/DataTable";
import { OrderDrawer } from "@/frontend/components/OrderDrawer";
import { ProductDialog } from "@/frontend/components/ProductDialog";
import { ConfirmDialog } from "@/frontend/components/ConfirmDialog";
import { EmptyState } from "@/frontend/components/EmptyState";
import { StatCardSkeleton, TableSkeleton } from "@/frontend/components/SkeletonLoader";
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
  getMyQuotes,
  getAdminData,
  saveProduct,
  deleteProduct,
  setOrderStatus,
  setQuoteStatus,
} from "@/backend/api.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Admin Management — Polar Fiber" },
      { name: "description", content: "Polar Fiber executive operations, analytics, catalog, orders, and customer management." },
      { property: "og:title", content: "Admin Management — Polar Fiber" },
      { property: "og:description", content: "Polar Fiber executive operations." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

const PIE_COLORS = ["#0ea5e9", "#6366f1", "#10b981", "#f59e0b", "#f43f5e"];

function AdminPage() {
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

  // Queries
  const overviewQuery = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => fetchOverview(),
    enabled: user?.role === "admin",
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
    enabled: user?.role === "admin",
  });

  const productsQuery = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => fetchCatalog(),
    enabled: user?.role === "admin",
  });

  const adminDataQuery = useQuery({
    queryKey: ["admin", "data"],
    queryFn: () => fetchQuotesList(),
    enabled: user?.role === "admin",
  });

  const customersQuery = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: () => fetchCustomerList(),
    enabled: user?.role === "admin",
  });

  // Guard against non-admin
  if (!user || user.role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-destructive/15 text-destructive shadow-xs">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold">Administrator Access Required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You must be logged in with an administrator account to access this management dashboard.
        </p>
        <Button asChild className="mt-6 w-full">
          <Link to="/login">Sign In with Admin Account</Link>
        </Button>
      </div>
    );
  }

  // Handle order status change
  const handleOrderStatusChange = async (orderId: number, newStatus: OrderStatus) => {
    setStatusUpdating(true);
    try {
      await mutateOrderStatus({ data: { id: orderId, status: newStatus } });
      toast.success(`Order #${orderId} status updated to ${newStatus}`);
      if (selectedOrder && selectedOrder.order_id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
      await qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      await qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update order status");
    } finally {
      setStatusUpdating(false);
    }
  };

  // Handle quote status change
  const handleQuoteStatusChange = async (quoteId: number, newStatus: QuoteStatus) => {
    try {
      await mutateQuoteStatus({ data: { id: quoteId, status: newStatus } });
      toast.success(`Inquiry #${quoteId} status set to ${newStatus}`);
      if (selectedQuote && selectedQuote.quote_id === quoteId) {
        setSelectedQuote({ ...selectedQuote, status: newStatus });
      }
      await qc.invalidateQueries({ queryKey: ["admin", "data"] });
      await qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update quote status");
    }
  };

  // Handle product save
  const handleProductSave = async (prod: Product) => {
    setSavingProduct(true);
    try {
      await mutateSaveProduct({ data: prod });
      toast.success(prod.product_id ? "Product updated successfully" : "Product created successfully");
      await qc.invalidateQueries({ queryKey: ["admin", "products"] });
      await qc.invalidateQueries({ queryKey: productsKey });
      await qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSavingProduct(false);
    }
  };

  // Handle product delete
  const handleProductDelete = async () => {
    if (!deletingProduct) return;
    try {
      await mutateDeleteProduct({ data: { id: deletingProduct.product_id } });
      toast.success(`Deleted ${deletingProduct.name}`);
      await qc.invalidateQueries({ queryKey: ["admin", "products"] });
      await qc.invalidateQueries({ queryKey: productsKey });
      await qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete product");
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

  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    {
      id: "orders",
      label: "Orders",
      icon: ShoppingBag,
      badge: overviewQuery.data?.kpis.totalOrders ?? undefined,
    },
    {
      id: "products",
      label: "Products",
      icon: Package,
      badge: (overviewQuery.data?.kpis.lowStockCount ?? 0) > 0 ? `${overviewQuery.data?.kpis.lowStockCount} low` : undefined,
    },
    {
      id: "quotes",
      label: "Quotes",
      icon: MessageSquare,
      badge: (overviewQuery.data?.kpis.newQuotes ?? 0) > 0 ? overviewQuery.data?.kpis.newQuotes : undefined,
    },
    { id: "customers", label: "Customers", icon: Users },
  ];

  // Overview data shortcuts
  const overview = overviewQuery.data;

  // Filtered products
  const allProducts = productsQuery.data ?? [];
  const filteredProducts = allProducts.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.description.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCategory = productCategoryFilter === "all" || p.category === productCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filtered quotes
  const allQuotes = adminDataQuery.data?.quotes ?? [];
  const filteredQuotes = allQuotes.filter((q) => {
    return quoteFilter === "all" || q.status === quoteFilter;
  });

  // Filtered customers
  const allCustomers = customersQuery.data ?? [];
  const filteredCustomers = allCustomers.filter((c) => {
    return (
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch)
    );
  });

  // Order Table Columns
  const orderColumns: Column<Order>[] = [
    {
      key: "order_id",
      header: "Order #",
      className: "font-semibold",
      render: (o) => <span className="font-semibold text-foreground">#{o.order_id}</span>,
    },
    {
      key: "customer",
      header: "Customer",
      render: (o) => <span className="font-medium text-foreground">{o.customer ?? "Guest"}</span>,
    },
    {
      key: "created_at",
      header: "Date Placed",
      render: (o) => <span className="text-muted-foreground">{o.created_at}</span>,
    },
    {
      key: "items",
      header: "Items Ordered",
      render: (o) => (
        <span className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
          {o.items.map((i) => `${i.quantity} × ${i.product_name}`).join(", ")}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      className: "font-display font-semibold text-primary",
      render: (o) => <span className="font-display font-bold text-primary">{etb(o.total)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (o) => <StatusBadge s={o.status} />,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (o) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedOrder(o);
            setOrderDrawerOpen(true);
          }}
          className="text-xs font-semibold text-primary"
        >
          Manage
        </Button>
      ),
    },
  ];

  return (
    <DashboardLayout
      title={
        activeTab === "overview"
          ? "Operations Overview"
          : activeTab === "orders"
            ? "Order Management"
            : activeTab === "products"
              ? "Catalog & Inventory"
              : activeTab === "quotes"
                ? "Customer Quote Requests"
                : "Customer Accounts"
      }
      subtitle={
        activeTab === "overview"
          ? "Real-time key performance indicators, 30-day revenue analytics, and priority tasks."
          : activeTab === "orders"
            ? "Search, track, export, and fulfill customer equipment orders."
            : activeTab === "products"
              ? "Manage fiberglass product listings, specs, inventory counts, and prices."
              : activeTab === "quotes"
                ? "Review technical quote requests, communicate with customers, and update status."
                : "View customer order history, aggregate spending, and contact details."
      }
      items={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      isAdmin={true}
      headerAction={
        activeTab === "products" ? (
          <Button
            size="sm"
            onClick={() => {
              setEditingProduct(null);
              setProductDialogOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add New Product
          </Button>
        ) : activeTab === "orders" ? (
          <Button size="sm" variant="outline" onClick={exportOrdersCSV} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        ) : undefined
      }
    >
      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          {/* KPI Cards */}
          {overviewQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={DollarSign}
                label="Total Revenue"
                value={etb(overview?.kpis.totalRevenue ?? 0)}
                subtext="Excluding cancelled orders"
                variant="accent"
              />
              <StatCard
                icon={ShoppingBag}
                label="Total Orders"
                value={overview?.kpis.totalOrders ?? 0}
                subtext="All-time customer orders"
                variant="default"
                onClick={() => setActiveTab("orders")}
              />
              <StatCard
                icon={MessageSquare}
                label="New Quotes"
                value={overview?.kpis.newQuotes ?? 0}
                subtext="Awaiting response"
                variant={overview?.kpis.newQuotes ? "warning" : "default"}
                onClick={() => setActiveTab("quotes")}
              />
              <StatCard
                icon={AlertTriangle}
                label="Low Stock Items"
                value={overview?.kpis.lowStockCount ?? 0}
                subtext="Inventory <= 5 units"
                variant={overview?.kpis.lowStockCount ? "warning" : "default"}
                onClick={() => setActiveTab("products")}
              />
            </div>
          )}

          {/* Charts Section */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Orders Timeline Chart (2 cols) */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs lg:col-span-2">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="font-display text-base font-bold text-foreground">
                    30-Day Orders & Revenue Trend
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Daily order volume and completed sales totals
                  </p>
                </div>
              </div>

              <div className="mt-4 h-64 w-full">
                {overview?.timeline && overview.timeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={overview.timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        stroke="var(--color-muted-foreground)"
                        tickFormatter={(v) => v.slice(5)}
                      />
                      <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-card)",
                          borderColor: "var(--color-border)",
                          borderRadius: "0.5rem",
                          fontSize: "12px",
                        }}
                        formatter={(value, name) => [
                          name === "total" ? etb(Number(value)) : value,
                          name === "total" ? "Revenue" : "Orders Placed",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#0ea5e9"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        activeDot={{ r: 6 }}
                        name="count"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No order activity recorded in the last 30 days.
                  </div>
                )}
              </div>
            </div>

            {/* Status Distribution Donut Chart (1 col) */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="border-b border-border pb-3">
                <h3 className="font-display text-base font-bold text-foreground">Order Statuses</h3>
                <p className="text-xs text-muted-foreground">Distribution across all orders</p>
              </div>

              <div className="mt-4 h-64 w-full">
                {overview?.statusDistribution && overview.statusDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={overview.statusDistribution}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {overview.statusDistribution.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-card)",
                          borderColor: "var(--color-border)",
                          borderRadius: "0.5rem",
                          fontSize: "12px",
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(val) => <span className="text-xs text-foreground">{val}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No order data available.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Revenue by Category Bar Chart */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="border-b border-border pb-3">
              <h3 className="font-display text-base font-bold text-foreground">Revenue by Category</h3>
              <p className="text-xs text-muted-foreground">
                Total ETB sales generated across catalog categories
              </p>
            </div>

            <div className="mt-4 h-60 w-full">
              {overview?.categoryRevenue && overview.categoryRevenue.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.categoryRevenue} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <XAxis dataKey="category" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="var(--color-muted-foreground)"
                      tickFormatter={(v) => `${v / 1000}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        borderColor: "var(--color-border)",
                        borderRadius: "0.5rem",
                        fontSize: "12px",
                      }}
                      formatter={(val) => [etb(Number(val)), "Total Revenue"]}
                    />
                    <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  No category revenue recorded.
                </div>
              )}
            </div>
          </div>

          {/* Needs Attention Panel */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-border pb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">Needs Immediate Attention</h3>
                <p className="text-xs text-muted-foreground">
                  Pending orders, unreviewed quote inquiries, and depleted stock items.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {/* Pending Orders */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Pending Orders ({overview?.attention.pendingOrders.length ?? 0})</span>
                  <button
                    onClick={() => {
                      setOrdersStatus("Pending");
                      setActiveTab("orders");
                    }}
                    className="text-primary hover:underline cursor-pointer"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-2">
                  {(overview?.attention.pendingOrders.length ?? 0) === 0 ? (
                    <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      No pending orders.
                    </p>
                  ) : (
                    overview?.attention.pendingOrders.map((ord) => (
                      <div
                        key={ord.order_id}
                        onClick={() => {
                          setSelectedOrder(ord);
                          setOrderDrawerOpen(true);
                        }}
                        className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 text-xs transition-colors hover:bg-muted/70 cursor-pointer"
                      >
                        <div>
                          <p className="font-semibold text-foreground">Order #{ord.order_id}</p>
                          <p className="text-muted-foreground">{ord.customer}</p>
                        </div>
                        <span className="font-display font-semibold text-primary">{etb(ord.total)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* New Quotes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>New Quotes ({overview?.attention.newQuotes.length ?? 0})</span>
                  <button
                    onClick={() => {
                      setQuoteFilter("New");
                      setActiveTab("quotes");
                    }}
                    className="text-primary hover:underline cursor-pointer"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-2">
                  {(overview?.attention.newQuotes.length ?? 0) === 0 ? (
                    <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      No new quote requests.
                    </p>
                  ) : (
                    overview?.attention.newQuotes.map((q) => (
                      <div
                        key={q.quote_id}
                        onClick={() => {
                          setSelectedQuote(q);
                          setActiveTab("quotes");
                        }}
                        className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 text-xs transition-colors hover:bg-muted/70 cursor-pointer"
                      >
                        <div>
                          <p className="font-semibold text-foreground line-clamp-1">{q.subject}</p>
                          <p className="text-muted-foreground">{q.name}</p>
                        </div>
                        <StatusBadge s={q.status} />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Low Stock Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Low Stock ({overview?.attention.lowStockProducts.length ?? 0})</span>
                  <button
                    onClick={() => setActiveTab("products")}
                    className="text-primary hover:underline cursor-pointer"
                  >
                    Manage Inventory
                  </button>
                </div>

                <div className="space-y-2">
                  {(overview?.attention.lowStockProducts.length ?? 0) === 0 ? (
                    <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      All products well-stocked.
                    </p>
                  ) : (
                    overview?.attention.lowStockProducts.map((p) => (
                      <div
                        key={p.product_id}
                        onClick={() => {
                          setEditingProduct(p);
                          setProductDialogOpen(true);
                        }}
                        className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 text-xs transition-colors hover:bg-muted/70 cursor-pointer"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="truncate font-semibold text-foreground">{p.name}</p>
                          <p className="text-muted-foreground">{p.category}</p>
                        </div>
                        <span className="rounded-md bg-rose-500/15 px-2 py-0.5 font-bold text-rose-700 dark:text-rose-300">
                          {p.stock} left
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ORDERS TAB */}
      {activeTab === "orders" && (
        <div>
          <DataTable
            columns={orderColumns}
            data={ordersQuery.data?.orders ?? []}
            loading={ordersQuery.isLoading}
            rowKey={(o) => o.order_id}
            searchPlaceholder="Search order #, customer, address..."
            searchValue={ordersSearch}
            onSearchChange={(val) => {
              setOrdersSearch(val);
              setOrdersPage(1);
            }}
            filters={
              <select
                value={ordersStatus}
                onChange={(e) => {
                  setOrdersStatus(e.target.value);
                  setOrdersPage(1);
                }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Statuses</option>
                {ORDER_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            }
            pagination={{
              page: ordersPage,
              totalPages: ordersQuery.data?.totalPages ?? 1,
              totalItems: ordersQuery.data?.total ?? 0,
              pageSize: ordersPageSize,
              onPageChange: (p) => setOrdersPage(p),
            }}
            onRowClick={(o) => {
              setSelectedOrder(o);
              setOrderDrawerOpen(true);
            }}
            emptyTitle="No orders found"
            emptyDescription="No orders match your filter criteria."
          />
        </div>
      )}

      {/* PRODUCTS TAB */}
      {activeTab === "products" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <select
                value={productCategoryFilter}
                onChange={(e) => setProductCategoryFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3.5">Product</th>
                    <th className="px-4 py-3.5">Category</th>
                    <th className="px-4 py-3.5">Capacity</th>
                    <th className="px-4 py-3.5">Price</th>
                    <th className="px-4 py-3.5">Stock</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {productsQuery.isLoading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="h-5 w-full bg-muted rounded" />
                        </td>
                      </tr>
                    ))
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center">
                        <EmptyState
                          icon={Package}
                          title="No products found"
                          description="No products match your search or filter."
                          actionLabel="Add Product"
                          onAction={() => {
                            setEditingProduct(null);
                            setProductDialogOpen(true);
                          }}
                          className="border-none bg-transparent py-4"
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isLowStock = p.stock <= 5;
                      return (
                        <tr key={p.product_id} className="transition-colors hover:bg-muted/40">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              {p.image ? (
                                <img
                                  src={p.image}
                                  alt={p.name}
                                  className="h-10 w-10 shrink-0 rounded-lg object-cover border border-border"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                  <Package className="h-5 w-5" />
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-foreground">{p.name}</p>
                                <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                                  {p.description}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-muted-foreground">{p.category}</td>
                          <td className="px-4 py-3.5 text-muted-foreground">{p.capacity ?? "—"}</td>
                          <td className="px-4 py-3.5 font-display font-semibold text-primary">
                            {etb(p.price)}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={
                                isLowStock
                                  ? "inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/15 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:text-rose-300"
                                  : "font-medium text-foreground"
                              }
                            >
                              {isLowStock && <AlertTriangle className="h-3 w-3" />}
                              {p.stock} units
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditingProduct(p);
                                  setProductDialogOpen(true);
                                }}
                                aria-label="Edit product"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  setDeletingProduct(p);
                                  setConfirmDeleteDialogOpen(true);
                                }}
                                aria-label="Delete product"
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

      {/* QUOTES TAB */}
      {activeTab === "quotes" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <select
              value={quoteFilter}
              onChange={(e) => setQuoteFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Statuses</option>
              {QUOTE_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Quote Inbox List (1 col) */}
            <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-xs">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Inquiries Inbox ({filteredQuotes.length})
              </h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {filteredQuotes.length === 0 ? (
                  <p className="p-6 text-center text-xs text-muted-foreground">No quote requests found.</p>
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
                            ? "border-primary bg-primary/10 shadow-xs"
                            : isNew
                              ? "border-amber-500/30 bg-amber-500/5 hover:bg-muted/60"
                              : "border-border bg-card hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-foreground line-clamp-1">{q.subject}</p>
                          <StatusBadge s={q.status} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{q.name} · {q.created_at}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Quote Detail Panel (2 cols) */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-xs lg:col-span-2">
              {selectedQuote ? (
                <div className="flex flex-col h-full justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                      <div>
                        <span className="text-xs text-muted-foreground">Inquiry #{selectedQuote.quote_id}</span>
                        <h2 className="font-display text-xl font-bold text-foreground">
                          {selectedQuote.subject}
                        </h2>
                      </div>
                      <StatusBadge s={selectedQuote.status} />
                    </div>

                    <div className="grid gap-4 rounded-xl border border-border bg-muted/40 p-4 sm:grid-cols-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Requester Name:</span>
                        <p className="font-semibold text-foreground text-sm">{selectedQuote.name}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email Address:</span>
                        <p className="font-semibold text-primary text-sm">{selectedQuote.email}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Date Submitted:</span>
                        <p className="font-semibold text-foreground">{selectedQuote.created_at}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Message Content
                      </h4>
                      <div className="mt-2 rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                        {selectedQuote.message}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <Button asChild size="sm" className="gap-2">
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
                        Mark as Replied
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleQuoteStatusChange(selectedQuote.quote_id, "Closed")}
                        disabled={selectedQuote.status === "Closed"}
                      >
                        Close Inquiry
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={MessageSquare}
                  title="No inquiry selected"
                  description="Select a quote request from the inbox list on the left to view full message details and customer communication options."
                  className="border-none py-16"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMERS TAB */}
      {activeTab === "customers" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customers by name, email..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3.5">Customer Name</th>
                    <th className="px-4 py-3.5">Email</th>
                    <th className="px-4 py-3.5">Phone</th>
                    <th className="px-4 py-3.5">Role</th>
                    <th className="px-4 py-3.5">Orders</th>
                    <th className="px-4 py-3.5">Total Spent</th>
                    <th className="px-4 py-3.5">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customersQuery.isLoading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="h-5 w-full bg-muted rounded" />
                        </td>
                      </tr>
                    ))
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-xs text-muted-foreground">
                        No customer accounts found.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => (
                      <tr key={c.user_id} className="transition-colors hover:bg-muted/40">
                        <td className="px-4 py-3.5 font-semibold text-foreground">{c.name}</td>
                        <td className="px-4 py-3.5 text-muted-foreground">{c.email}</td>
                        <td className="px-4 py-3.5 text-muted-foreground">{c.phone || "—"}</td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                              c.role === "admin"
                                ? "bg-primary/20 text-primary border border-primary/30"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {c.role}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-foreground">{c.orders_count}</td>
                        <td className="px-4 py-3.5 font-display font-bold text-primary">
                          {etb(c.total_spent)}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">{c.created_at}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Admin Order Drawer */}
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

      {/* Confirm Delete Product Dialog */}
      <ConfirmDialog
        open={confirmDeleteDialogOpen}
        onOpenChange={setConfirmDeleteDialogOpen}
        title={`Delete "${deletingProduct?.name}"?`}
        description="Are you sure you want to delete this product from the catalog? This action cannot be undone."
        confirmLabel="Delete Product"
        variant="destructive"
        onConfirm={handleProductDelete}
      />
    </DashboardLayout>
  );
}
