import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { StatusBadge } from "@/frontend/components/StatusBadge";
import { OrderDrawer } from "@/frontend/components/OrderDrawer";
import { useStore } from "@/frontend/store";
import { etb, type Order } from "@/shared/data";
import { Search, Plus } from "lucide-react";
import { getMyOrders } from "@/backend/api.functions";

export const Route = createFileRoute("/dashboard/orders")({
  component: DashboardOrders,
  validateSearch: (search: Record<string, unknown>): { status?: string | undefined } => ({
    status: (search["status"] as string) || undefined,
  }),
});

function DashboardOrders() {
  const { user, addToCart } = useStore();
  const nav = useNavigate();
  const { status } = Route.useSearch();
  const initialStatus = status || "all";

  const fetchOrders = useServerFn(getMyOrders);

  const ordersQuery = useQuery({
    queryKey: ["customer", "orders", user?.user_id],
    queryFn: () => fetchOrders(),
    enabled: !!user,
  });

  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
  const [orderDrawerOpen, setOrderDrawerOpen] = React.useState(false);
  const [orderSearch, setOrderSearch] = React.useState("");
  const [orderStatusFilter, setOrderStatusFilter] = React.useState(initialStatus);

  const allOrders = ordersQuery.data ?? [];

  const filteredOrders = allOrders.filter((o) => {
    const matchesSearch =
      o.order_id.toString().includes(orderSearch) ||
      o.address.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.items.some((i) => i.product_name.toLowerCase().includes(orderSearch.toLowerCase()));
    const matchesStatus = orderStatusFilter === "all" || o.status === orderStatusFilter;
    return matchesSearch && matchesStatus;
  });

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

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">My Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track manufacturing, shipping status, and order history
          </p>
        </div>
        <Button
          asChild
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
        >
          <Link to="/products">
            <Plus className="h-4 w-4" />
            New Order
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search order #, items, address..."
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
            className="pl-9 border-border"
          />
        </div>
        <select
          value={orderStatusFilter}
          onChange={(e) => setOrderStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground"
        >
          <option value="all">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Confirmed">Confirmed</option>
          <option value="In Production">In Production</option>
          <option value="Delivered">Delivered</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4">Order #</th>
                <th className="px-5 py-4">Date Placed</th>
                <th className="px-5 py-4">Ordered Items</th>
                <th className="px-5 py-4">Total</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-muted-foreground/60 text-sm"
                  >
                    No orders found matching your search.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr
                    key={o.order_id}
                    onClick={() => {
                      setSelectedOrder(o);
                      setOrderDrawerOpen(true);
                    }}
                    className="hover:bg-muted/40 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-4 font-bold text-foreground">#{o.order_id}</td>
                    <td className="px-5 py-4 text-muted-foreground text-xs">{o.created_at}</td>
                    <td className="px-5 py-4 text-xs text-muted-foreground max-w-xs truncate">
                      {o.items.map((i) => `${i.quantity}x ${i.product_name}`).join(", ")}
                    </td>
                    <td className="px-5 py-4 font-bold text-primary">{etb(o.total)}</td>
                    <td className="px-5 py-4">
                      <StatusBadge s={o.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-primary font-semibold"
                      >
                        Track Details
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
