import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/frontend/components/ui/button";
import { StatusBadge } from "@/frontend/components/StatusBadge";
import { OrderDrawer } from "@/frontend/components/OrderDrawer";
import { useStore, productsKey } from "@/frontend/store";
import { etb, type Order, type Quote } from "@/shared/data";
import {
  Package,
  FileText,
  CheckCircle2,
  Bell,
} from "lucide-react";
import {
  getMyOrders,
  getMyQuotes,
  getMyNotifications,
  getCustomerConversations,
} from "@/backend/api.functions";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardOverview,
});

function DashboardOverview() {
  const { user, addToCart } = useStore();
  const nav = useNavigate();

  const fetchOrders = useServerFn(getMyOrders);
  const fetchQuotes = useServerFn(getMyQuotes);
  const fetchNotifications = useServerFn(getMyNotifications);

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

  const notificationsQuery = useQuery({
    queryKey: ["customer", "notifications", user?.user_id],
    queryFn: () => fetchNotifications(),
    enabled: !!user,
  });

  // Order drawer state
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
  const [orderDrawerOpen, setOrderDrawerOpen] = React.useState(false);

  const allOrders = ordersQuery.data ?? [];
  const allQuotes = quotesQuery.data ?? [];

  const activeOrdersCount = allOrders.filter(
    (o) => o.status === "Pending" || o.status === "Confirmed" || o.status === "In Production",
  ).length;
  const pendingQuotesCount = allQuotes.filter((q) => q.status === "New").length;
  const completedOrdersCount = allOrders.filter((o) => o.status === "Delivered").length;

  // Unread notifications count
  const dbUnreadCount = (notificationsQuery.data ?? []).filter((n) => !n.is_read).length;
  const unreadNotificationsCount = dbUnreadCount > 0 ? dbUnreadCount : 1;

  const recentOrders = allOrders.slice(0, 5);
  const recentQuotes = allQuotes.slice(0, 5);

  const handleReorder = (order: Order) => {
    let addedCount = 0;
    for (const item of order.items) {
      if (item.product_id) {
        addToCart(item.product_id, item.quantity);
        addedCount += item.quantity;
      }
    }
    setOrderDrawerOpen(false);
    nav({ to: "/cart" });
  };

  if (!user) return null;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Greeting Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome, {user.name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Here is an overview of your account activity.
        </p>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
        {/* Card 1: Active Orders */}
        <Link
          to="/dashboard/orders"
          className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
        >
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Active Orders</p>
            <p className="text-3xl font-bold text-foreground mt-1.5">{activeOrdersCount}</p>
          </div>
          <div className="h-13 w-13 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
            <Package className="h-6 w-6 stroke-[2]" />
          </div>
        </Link>

        {/* Card 2: Pending Quotes */}
        <Link
          to="/dashboard/quotes"
          className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
        >
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Pending Quotes</p>
            <p className="text-3xl font-bold text-foreground mt-1.5">{pendingQuotesCount}</p>
          </div>
          <div className="h-13 w-13 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 group-hover:scale-105 transition-transform">
            <FileText className="h-6 w-6 stroke-[2]" />
          </div>
        </Link>

        {/* Card 3: Completed Orders */}
        <Link
          to="/dashboard/orders"
          search={{ status: "Delivered" }}
          className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
        >
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Completed Orders</p>
            <p className="text-3xl font-bold text-foreground mt-1.5">{completedOrdersCount}</p>
          </div>
          <div className="h-13 w-13 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:scale-105 transition-transform">
            <CheckCircle2 className="h-6 w-6 stroke-[2]" />
          </div>
        </Link>

        {/* Card 4: Unread Notifications */}
        <Link
          to="/dashboard/notifications"
          className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
        >
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Unread Notifications</p>
            <p className="text-3xl font-bold text-foreground mt-1.5">{unreadNotificationsCount}</p>
          </div>
          <div className="h-13 w-13 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
            <Bell className="h-6 w-6 stroke-[2]" />
          </div>
        </Link>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex items-center gap-3 pt-1">
        <Button
          asChild
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-5 py-2.5 rounded-xl shadow-xs"
        >
          <Link to="/products">Browse Products</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="bg-card border-border hover:bg-muted/60 text-foreground font-medium px-5 py-2.5 rounded-xl"
        >
          <Link to="/quote">Request a Quote</Link>
        </Button>
      </div>

      {/* Recent Orders Card */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-base font-bold text-foreground">Recent Orders</h2>
          <Link
            to="/dashboard/orders"
            className="text-xs font-semibold text-primary hover:text-primary/80 cursor-pointer"
          >
            View All
          </Link>
        </div>

        <div className="pt-6">
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No orders yet.{" "}
              <Link to="/products" className="text-primary font-semibold hover:underline">
                Browse products
              </Link>{" "}
              to place your first order.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {recentOrders.map((ord) => (
                <div
                  key={ord.order_id}
                  onClick={() => {
                    setSelectedOrder(ord);
                    setOrderDrawerOpen(true);
                  }}
                  className="py-3.5 flex items-center justify-between hover:bg-muted/40 px-2 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-sm text-foreground">
                        Order #{ord.order_id}
                      </span>
                      <StatusBadge s={ord.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {ord.created_at} ·{" "}
                      {ord.items
                        .map((i) => `${i.quantity}x ${i.product_name}`)
                        .join(", ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-primary text-sm">{etb(ord.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Quotes Card */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-base font-bold text-foreground">Recent Quotes</h2>
          <Link
            to="/dashboard/quotes"
            className="text-xs font-semibold text-primary hover:text-primary/80 cursor-pointer"
          >
            View All
          </Link>
        </div>

        <div className="pt-6">
          {recentQuotes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No quotes yet.{" "}
              <Link to="/quote" className="text-primary font-semibold hover:underline">
                Request a quote
              </Link>{" "}
              to get started.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {recentQuotes.map((q) => (
                <Link
                  key={q.quote_id}
                  to="/dashboard/quotes"
                  className="py-3.5 flex items-center justify-between hover:bg-muted/40 px-2 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {q.subject}
                      </span>
                      <StatusBadge s={q.status} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{q.created_at}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-xs text-primary shrink-0">
                    View
                  </Button>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Order Drawer */}
      <OrderDrawer
        order={selectedOrder}
        open={orderDrawerOpen}
        onOpenChange={setOrderDrawerOpen}
        mode="customer"
        onReorder={handleReorder}
      />
    </div>
  );
}
