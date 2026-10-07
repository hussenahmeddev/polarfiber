import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  LayoutDashboard,
  ShoppingBag,
  MessageSquare,
  User,
  Package,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Plus,
} from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { DashboardLayout } from "@/frontend/components/DashboardLayout";
import { StatCard } from "@/frontend/components/StatCard";
import { StatusBadge } from "@/frontend/components/StatusBadge";
import { DataTable, type Column } from "@/frontend/components/DataTable";
import { OrderDrawer } from "@/frontend/components/OrderDrawer";
import { EmptyState } from "@/frontend/components/EmptyState";
import { StatCardSkeleton, TableSkeleton } from "@/frontend/components/SkeletonLoader";
import {
  etb,
  type Order,
  type Quote,
} from "@/shared/data";
import { useStore } from "@/frontend/store";
import {
  getMyDashboard,
  getMyOrders,
  getMyQuotes,
  updateMyProfile,
  changeMyPassword,
} from "@/backend/api.functions";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Customer Dashboard — Polar Fiber" },
      { name: "description", content: "Manage your Polar Fiber orders, quote requests, and account settings." },
      { property: "og:title", content: "Customer Dashboard — Polar Fiber" },
      { property: "og:description", content: "Track your orders, quotes, and profile." },
    ],
  }),
  component: CustomerAccountPage,
});

function CustomerAccountPage() {
  const { user, refreshUser, addToCart } = useStore();
  const nav = useNavigate();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = React.useState("overview");
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
  const [orderDrawerOpen, setOrderDrawerOpen] = React.useState(false);

  // Search and filter state for orders
  const [orderSearch, setOrderSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  // Server function hooks
  const fetchDashboard = useServerFn(getMyDashboard);
  const fetchOrders = useServerFn(getMyOrders);
  const fetchQuotes = useServerFn(getMyQuotes);
  const mutateProfile = useServerFn(updateMyProfile);
  const mutatePassword = useServerFn(changeMyPassword);

  // Queries
  const dashboardQuery = useQuery({
    queryKey: ["customer", "dashboard", user?.user_id],
    queryFn: () => fetchDashboard(),
    enabled: !!user,
  });

  const ordersQuery = useQuery({
    queryKey: ["customer", "orders", user?.user_id],
    queryFn: () => fetchOrders(),
    enabled: !!user,
  });

  const quotesQuery = useQuery({
    queryKey: ["customer", "quotes", user?.user_id],
    queryFn: () => fetchQuotes(),
    enabled: !!user,
  });

  // Profile Form State
  const [profileName, setProfileName] = React.useState(user?.name ?? "");
  const [profilePhone, setProfilePhone] = React.useState(user?.phone ?? "");
  const [savingProfile, setSavingProfile] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfilePhone(user.phone);
    }
  }, [user]);

  // Password Form State
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [changingPassword, setChangingPassword] = React.useState(false);

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-muted text-primary shadow-xs">
          <User className="h-7 w-7" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold">Please Sign In</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to access your customer dashboard, track orders, and view quote inquiries.
        </p>
        <Button asChild className="mt-6 w-full">
          <Link to="/login">Sign In to Polar Fiber</Link>
        </Button>
      </div>
    );
  }

  // Handle reorder
  const handleReorder = (order: Order) => {
    let addedCount = 0;
    for (const item of order.items) {
      if (item.product_id) {
        addToCart(item.product_id, item.quantity);
        addedCount += item.quantity;
      }
    }
    toast.success(`Added ${addedCount} item(s) from Order #${order.order_id} to your cart.`);
    setOrderDrawerOpen(false);
    nav({ to: "/cart" });
  };

  // Handle profile update
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      toast.error("Name is required");
      return;
    }
    setSavingProfile(true);
    try {
      await mutateProfile({ data: { name: profileName, phone: profilePhone } });
      await refreshUser();
      toast.success("Profile updated successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle password change
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Current password is required");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setChangingPassword(true);
    try {
      await mutatePassword({ data: { currentPassword, newPassword } });
      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    {
      id: "orders",
      label: "My Orders",
      icon: ShoppingBag,
      badge: ordersQuery.data?.length ?? undefined,
    },
    {
      id: "quotes",
      label: "My Quotes",
      icon: MessageSquare,
      badge: quotesQuery.data?.length ?? undefined,
    },
    { id: "profile", label: "Profile & Security", icon: User },
  ];

  // Filtered orders for table
  const allOrders = ordersQuery.data ?? [];
  const filteredOrders = allOrders.filter((o) => {
    const matchesSearch =
      o.order_id.toString().includes(orderSearch) ||
      o.address.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.items.some((i) => i.product_name.toLowerCase().includes(orderSearch.toLowerCase()));
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const orderColumns: Column<Order>[] = [
    {
      key: "order_id",
      header: "Order #",
      className: "font-semibold",
      render: (o) => <span className="font-semibold text-foreground">#{o.order_id}</span>,
    },
    {
      key: "created_at",
      header: "Date Placed",
      render: (o) => <span className="text-muted-foreground">{o.created_at}</span>,
    },
    {
      key: "items",
      header: "Ordered Items",
      render: (o) => (
        <span className="text-xs text-muted-foreground line-clamp-1">
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
          className="text-xs"
        >
          View Details
        </Button>
      ),
    },
  ];

  return (
    <DashboardLayout
      title={
        activeTab === "overview"
          ? `Welcome back, ${user.name}`
          : activeTab === "orders"
            ? "My Orders"
            : activeTab === "quotes"
              ? "My Quote Requests"
              : "Account & Security"
      }
      subtitle={
        activeTab === "overview"
          ? "Here is a summary of your recent orders, open quotes, and active shipments."
          : activeTab === "orders"
            ? "View and track the status of all your Polar Fiber orders."
            : activeTab === "quotes"
              ? "Track your custom fabrication inquiries and quote responses."
              : "Manage your contact info and change your account password."
      }
      items={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      headerAction={
        activeTab === "quotes" ? (
          <Button asChild size="sm" className="gap-2">
            <Link to="/quote">
              <Plus className="h-4 w-4" />
              Request New Quote
            </Link>
          </Button>
        ) : activeTab === "orders" ? (
          <Button asChild size="sm" variant="outline" className="gap-2">
            <Link to="/products">
              <ShoppingBag className="h-4 w-4" />
              Browse Products
            </Link>
          </Button>
        ) : undefined
      }
    >
      {/* Admin Quick Jump Banner if User is Admin */}
      {user.role === "admin" && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/30 bg-primary/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                You have Administrator Privileges
              </p>
              <p className="text-xs text-muted-foreground">
                Manage all customer orders, catalog inventory, quotes, and customer accounts.
              </p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link to="/admin">
              Open Admin Dashboard
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          {/* Stat Cards */}
          {dashboardQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                icon={Package}
                label="Active Orders"
                value={dashboardQuery.data?.stats.activeOrders ?? 0}
                subtext="Pending, Confirmed or In Production"
                variant="primary"
                onClick={() => setActiveTab("orders")}
              />
              <StatCard
                icon={CheckCircle2}
                label="Delivered Orders"
                value={dashboardQuery.data?.stats.deliveredOrders ?? 0}
                subtext="Successfully completed orders"
                variant="success"
                onClick={() => setActiveTab("orders")}
              />
              <StatCard
                icon={MessageSquare}
                label="Open Quotes"
                value={dashboardQuery.data?.stats.openQuotes ?? 0}
                subtext="Awaiting review or quotation"
                variant="warning"
                onClick={() => setActiveTab("quotes")}
              />
            </div>
          )}

          {/* Recent Orders Section */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">Recent Orders</h3>
                <p className="text-xs text-muted-foreground">
                  Your most recent order requests and status updates
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab("orders")}
                className="gap-1.5 text-xs font-semibold text-primary"
              >
                View all orders
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="mt-4 divide-y divide-border">
              {dashboardQuery.isLoading ? (
                <TableSkeleton rows={3} cols={4} />
              ) : (dashboardQuery.data?.recentOrders.length ?? 0) === 0 ? (
                <EmptyState
                  icon={ShoppingBag}
                  title="No orders yet"
                  description="You haven't placed any orders with Polar Fiber yet."
                  actionLabel="Explore Products"
                  onAction={() => nav({ to: "/products" })}
                  className="border-none py-8"
                />
              ) : (
                dashboardQuery.data?.recentOrders.map((order) => (
                  <div
                    key={order.order_id}
                    onClick={() => {
                      setSelectedOrder(order);
                      setOrderDrawerOpen(true);
                    }}
                    className="flex flex-col gap-3 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between cursor-pointer rounded-lg px-2"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-foreground">
                          Order #{order.order_id}
                        </span>
                        <StatusBadge s={order.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Placed on {order.created_at} · {order.items.length} item(s)
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {order.items.map((i) => `${i.quantity} × ${i.product_name}`).join(", ")}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                      <span className="font-display font-bold text-primary">
                        {etb(order.total)}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        Details <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MY ORDERS TAB */}
      {activeTab === "orders" && (
        <div>
          <DataTable
            columns={orderColumns}
            data={filteredOrders}
            loading={ordersQuery.isLoading}
            rowKey={(o) => o.order_id}
            searchPlaceholder="Search by order #, item, address..."
            searchValue={orderSearch}
            onSearchChange={setOrderSearch}
            onRowClick={(o) => {
              setSelectedOrder(o);
              setOrderDrawerOpen(true);
            }}
            filters={
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Confirmed">Confirmed</option>
                <option value="In Production">In Production</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            }
            emptyTitle="No orders found"
            emptyDescription="No orders match your search criteria or status filter."
            emptyActionLabel="Browse Catalog"
            onEmptyAction={() => nav({ to: "/products" })}
          />
        </div>
      )}

      {/* MY QUOTES TAB */}
      {activeTab === "quotes" && (
        <div className="space-y-4">
          {quotesQuery.isLoading ? (
            <TableSkeleton rows={4} cols={4} />
          ) : (quotesQuery.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No quote requests yet"
              description="Need custom fiberglass tankers, fittings, or special composite items? Request a quote from our engineers."
              actionLabel="Submit a Quote Request"
              onAction={() => nav({ to: "/quote" })}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {quotesQuery.data?.map((quote) => (
                <div
                  key={quote.quote_id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-xs transition-shadow hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                      <h4 className="font-semibold text-foreground line-clamp-1">
                        {quote.subject}
                      </h4>
                      <StatusBadge s={quote.status} />
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground line-clamp-3">
                      {quote.message}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>Submitted on {quote.created_at}</span>
                    <span className="font-medium text-foreground">Inquiry #{quote.quote_id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PROFILE & SECURITY TAB */}
      {activeTab === "profile" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Profile Card */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">Personal Details</h3>
                <p className="text-xs text-muted-foreground">
                  Update your contact information and display name.
                </p>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit} className="mt-5 space-y-4">
              <div>
                <Label htmlFor="profile-name">Full Name *</Label>
                <Input
                  id="profile-name"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="profile-email">Email Address</Label>
                <Input
                  id="profile-email"
                  value={user.email}
                  disabled
                  className="mt-1 bg-muted text-muted-foreground cursor-not-allowed"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Email address cannot be changed directly.
                </p>
              </div>

              <div>
                <Label htmlFor="profile-phone">Phone Number</Label>
                <Input
                  id="profile-phone"
                  placeholder="+251 911 000 000"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="mt-1"
                />
              </div>

              <Button type="submit" disabled={savingProfile} className="mt-2 w-full">
                {savingProfile ? "Saving changes..." : "Save Profile Details"}
              </Button>
            </form>
          </div>

          {/* Security / Password Card */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">Security & Password</h3>
                <p className="text-xs text-muted-foreground">
                  Update your password to keep your account safe.
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-4">
              <div>
                <Label htmlFor="curr-pass">Current Password *</Label>
                <Input
                  id="curr-pass"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="new-pass">New Password *</Label>
                <Input
                  id="new-pass"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="confirm-pass">Confirm New Password *</Label>
                <Input
                  id="confirm-pass"
                  type="password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              <Button type="submit" disabled={changingPassword} className="mt-2 w-full">
                {changingPassword ? "Updating password..." : "Change Password"}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Order Details Drawer */}
      <OrderDrawer
        order={selectedOrder}
        open={orderDrawerOpen}
        onOpenChange={setOrderDrawerOpen}
        mode="customer"
        onReorder={handleReorder}
      />
    </DashboardLayout>
  );
}
