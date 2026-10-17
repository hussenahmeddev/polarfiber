import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Copy, ShoppingBag, Clock, CheckCircle2, Mail, RotateCcw } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { cn } from "@/frontend/utils";
import { useServerFn } from "@tanstack/react-start";
import { getGuestOrderStatus } from "@/backend/api.functions";
import { etb } from "@/shared/data";

export const Route = createFileRoute("/order-confirmation")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Order Confirmed — Polar Fiber" },
      {
        name: "description",
        content:
          "Your Polar Fiber order has been confirmed. Track it with your order number and email.",
      },
    ],
  }),
  component: OrderConfirmation,
});

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return dateStr;
  }
}

function OrderConfirmation() {
  const orderIdRaw = new URLSearchParams(window.location.search).get("order_id");
  const orderId = orderIdRaw ? Number(orderIdRaw) : null;

  const fetchOrder = useServerFn(getGuestOrderStatus);
  const [order, setOrder] = useState<{
    order_id: number;
    order_number: string | null;
    status: string;
    total: number;
    address: string;
    payment_method: string;
    is_paid: boolean;
    created_at: string;
  } | null>(null);
  const [items, setItems] = useState<
    Array<{
      product_id: number;
      product_name: string;
      quantity: number;
      unit_price: number;
    }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    setBusy(true);
    void (async () => {
      try {
        const data = await fetchOrder({ data: { order_id: orderId } });
        setOrder(data.order);
        setItems(data.items);
      } catch {
        toast.error("Could not load order details. Please track your order instead.");
      } finally {
        setBusy(false);
      }
    })();
  }, [orderId, fetchOrder]);

  async function copyOrderNumber() {
    const num = order?.order_number ?? `PF-ORD-${orderId}`;
    await navigator.clipboard.writeText(num);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <ShoppingBag className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 text-3xl font-bold">Order Confirmed</h1>
        {busy ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading your order…</p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Order not found. Please verify your order number and email on the tracking page.
          </p>
        )}
        <Button asChild className="mt-8">
          <Link to="/order-tracking">Track Order</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="text-center mb-8">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <h1 className="mt-4 text-3xl font-bold">Order Confirmed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Thank you for your order, Polar Fiber customer.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Order number</h2>
            <p className="text-sm text-muted-foreground">{formatDate(order.created_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={order.order_number ?? `PF-ORD-${orderId}`}
              readOnly
              className="font-mono font-semibold text-lg pl-8"
            />
            <Button
              size="sm"
              onClick={copyOrderNumber}
              className="h-8 px-3"
              aria-label={copied ? "Copied" : "Copy order number"}
            >
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="col-span-2">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Status</dt>
            <dd className="font-semibold text-foreground capitalize">{order.status}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Order date</dt>
            <dd className="text-foreground">{formatDate(order.created_at)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Delivery destination
            </dt>
            <dd className="text-foreground">{order.address}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Payment method
            </dt>
            <dd className="text-foreground capitalize">{order.payment_method}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Payment status
            </dt>
            <dd
              className={cn(
                "font-semibold",
                order.is_paid ? "text-success" : "text-muted-foreground",
              )}
            >
              {order.is_paid ? "Paid" : "Awaiting payment (cash on delivery)"}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Order total</dt>
            <dd className="font-display text-xl font-bold text-primary">{etb(order.total)}</dd>
          </div>
        </dl>

        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Ordered products ({items.length})
          </h3>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {items.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No items.</p>
            ) : (
              items.map((item) => (
                <div
                  key={`${item.product_id}-${item.quantity}`}
                  className="flex items-center justify-between p-4"
                >
                  <div>
                    <p className="font-semibold text-foreground">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × {etb(item.unit_price)}
                    </p>
                  </div>
                  <p className="font-semibold text-foreground">
                    {etb(item.quantity * item.unit_price)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/50 p-6 mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">Track your order</h2>
        <p className="text-sm text-muted-foreground mb-4">
          To view delivery updates and message our team about this order, go to the tracking page
          and enter your order number, the email address you used at checkout, and the order-access
          password you set during checkout. No account is required.
        </p>
        <Button asChild size="lg" className="w-full">
          <Link to="/order-tracking">
            <ShoppingBag className="mr-2 h-4 w-4" />
            Track Order
          </Link>
        </Button>
      </div>

      <div className="mt-8 flex items-center gap-2">
        <Button asChild variant="outline">
          <Link to="/products">
            <RotateCcw className="mr-2 h-4 w-4" />
            Browse more products
          </Link>
        </Button>
        <Mail className="h-5 w-5 text-muted-foreground ml-auto" />
      </div>
    </div>
  );
}
