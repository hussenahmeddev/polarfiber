import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Send,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Factory,
  Truck,
  XCircle,
  ChevronLeft,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Textarea } from "@/frontend/components/ui/textarea";
import { useServerFn } from "@tanstack/react-start";
import {
  verifyOrderAccessByEmail,
  startOrderAccessSession,
  endOrderAccess,
  getGuestOrderStatus,
  sendGuestOrderMessage,
} from "@/backend/api.functions";
import { ORDER_STATUSES, etb, type OrderStatus } from "@/shared/data";
import { cn } from "@/frontend/utils";

export const Route = createFileRoute("/order-tracking")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Track Your Order — Polar Fiber" },
      {
        name: "description",
        content:
          "Enter your email and order-access password to access your orders and message our team.",
      },
      { property: "og:title", content: "Track Your Order — Polar Fiber" },
      {
        property: "og:description",
        content: "Sign in with your email and order-access password to view your orders.",
      },
    ],
  }),
  component: OrderTracking,
});

const STEPS: { status: OrderStatus; label: string; icon: React.ElementType }[] = [
  { status: "Pending", label: "Pending", icon: Clock },
  { status: "Confirmed", label: "Confirmed", icon: CheckCircle2 },
  { status: "In Production", label: "In Production", icon: Factory },
  { status: "Out for Delivery", label: "Out for Delivery", icon: Truck },
  { status: "Delivered", label: "Delivered", icon: CheckCircle2 },
];

const STEP_INDEX_MAP: Record<OrderStatus, number> = {
  Pending: 0,
  Confirmed: 1,
  "In Production": 2,
  "Out for Delivery": 3,
  Delivered: 4,
  Cancelled: -1,
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return dateStr;
  }
}

interface OrderSummary {
  order_id: number;
  order_number: string | null;
  status: OrderStatus;
  total: number;
  address: string;
  payment_method: string;
  is_paid: boolean;
  created_at: string;
  items: Array<{ product_id: number; product_name: string; quantity: number; unit_price: number }>;
}

function OrderTracking() {
  const nav = useNavigate();
  const [view, setView] = useState<"form" | "orders" | "order-detail">("form");
  const [form, setForm] = useState({ email: "", access_password: "" });
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<OrderSummary[]>([]);

  // Order detail state
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [messages, setMessages] = useState<
    Array<{
      id: number;
      sender_type: string;
      sender_name: string;
      kind: string;
      body: string | null;
      status_from: string | null;
      status_to: string | null;
      created_at: string;
    }>
  >([]);
  const [delivery, setDelivery] = useState<{
    order_id: number;
    delivery_notes: string | null;
    expected_delivery_date: string | null;
    dispatched_at: string | null;
    delivered_at: string | null;
    assigned_name: string | null;
  } | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);

  const verifyByEmail = useServerFn(verifyOrderAccessByEmail);
  const startSession = useServerFn(startOrderAccessSession);
  const endAccess = useServerFn(endOrderAccess);
  const fetchOrder = useServerFn(getGuestOrderStatus);
  const sendMessage = useServerFn(sendGuestOrderMessage);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim() || !form.access_password) {
      toast.error("Please enter your email and order-access password.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const result = await verifyByEmail({
        data: { email: form.email, access_password: form.access_password },
      });
      setOrders(result.orders.map((o) => ({ ...o, is_paid: Boolean(o.is_paid) })));
      setView("orders");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid email or order-access password.");
    } finally {
      setBusy(false);
    }
  }

  async function openOrder(orderId: number) {
    setDetailBusy(true);
    try {
      await startSession({ data: { order_id: orderId } });
      const data = await fetchOrder({ data: { order_id: orderId } });
      setOrder({ ...data.order, items: [] });
      setMessages(data.messages);
      setDelivery(data.delivery ?? null);
      setView("order-detail");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open order.");
    } finally {
      setDetailBusy(false);
    }
  }

  function backToOrders() {
    setView("orders");
    setOrder(null);
    setMessages([]);
    setDelivery(null);
    setMessageInput("");
    void endAccess({});
  }

  async function onSendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = messageInput.trim();
    if (!text || !order) return;
    if (text.length > 2000) {
      toast.error("Message must be 2000 characters or fewer.");
      return;
    }
    setSending(true);
    try {
      await sendMessage({ data: { order_id: order.order_id, message: text } });
      setMessageInput("");
      const refreshed = await fetchOrder({ data: { order_id: order.order_id } });
      setMessages(refreshed.messages);
      toast.success("Message sent.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  const isCancelled = order?.status === "Cancelled";
  const currentStepIndex = order ? STEP_INDEX_MAP[order.status] : -1;

  if (view === "form") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-3xl font-bold">Track Your Order</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the email address and order-access password you used during checkout to securely
            access your orders, track delivery, and communicate with our team.
          </p>
        </div>

        <form noValidate className="mt-8 space-y-4" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="track-email">Email Address</Label>
            <Input
              id="track-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="access-password">Order-Access Password</Label>
            <Input
              id="access-password"
              type="password"
              value={form.access_password}
              onChange={(e) => setForm({ ...form, access_password: e.target.value })}
              maxLength={100}
              placeholder="Password set during checkout"
              required
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {busy ? "Signing in…" : "Track Order"}
          </Button>
        </form>
      </div>
    );
  }

  if (view === "orders") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Your Orders</h1>
            <p className="text-sm text-muted-foreground">
              Orders matching your email and order-access password.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setView("form")}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Sign in with different email
          </Button>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm text-muted-foreground">
              No orders found for this email and password.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const isCancelled = o.status === "Cancelled";
              return (
                <div
                  key={o.order_id}
                  className="rounded-xl border border-border bg-card p-5 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground">
                        Order #{o.order_number ?? o.order_id}
                      </span>
                      {isCancelled && (
                        <span className="text-xs font-semibold text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded">
                          Cancelled
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Placed {formatDate(o.created_at)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {o.items.length} item(s) · {etb(o.total)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {o.address} ·{" "}
                      {o.payment_method.charAt(0).toUpperCase() + o.payment_method.slice(1)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Payment: {o.is_paid ? "Paid" : "Awaiting payment"} · Status:{" "}
                      <span className="font-semibold text-foreground capitalize">{o.status}</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void openOrder(o.order_id)}
                    className="text-xs h-8 px-4"
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    View Order
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Order detail view
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" size="sm" onClick={backToOrders}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to orders
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Order #{order?.order_number ?? order!.order_id}</h1>
          <p className="text-sm text-muted-foreground">Placed on {formatDate(order!.created_at)}</p>
        </div>
      </div>

      {/* Status progression */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Order Status Progression</h2>
        {isCancelled ? (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-300">
            <XCircle className="h-6 w-6 shrink-0" />
            <div>
              <p className="font-semibold">Order Cancelled</p>
              <p className="text-xs text-rose-600/90 dark:text-rose-300/80">
                This order was cancelled and is no longer being processed.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 relative">
            <div className="grid grid-cols-4 gap-2">
              {STEPS.map((step, idx) => {
                const isCompleted = currentStepIndex >= idx;
                const isCurrent = currentStepIndex === idx;
                const StepIcon = step.icon;
                return (
                  <div key={step.status} className="flex flex-col items-center text-center">
                    <div
                      className={
                        "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all" +
                        (isCompleted
                          ? " border-primary bg-primary text-primary-foreground shadow-xs"
                          : " border-border bg-muted text-muted-foreground") +
                        (isCurrent ? " ring-4 ring-primary/20" : "")
                      }
                    >
                      <StepIcon className="h-4 w-4" />
                    </div>
                    <span
                      className={
                        "mt-2 text-[11px] font-medium leading-tight" +
                        (isCompleted ? " font-semibold text-foreground" : " text-muted-foreground")
                      }
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="absolute left-[12.5%] right-[12.5%] top-5 -z-0 h-0.5 -translate-y-1/2 bg-border">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width:
                    currentStepIndex >= 0
                      ? `${(currentStepIndex / (STEPS.length - 1)) * 100}%`
                      : "0%",
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
        {/* Order information */}
        <div className="lg:col-span-4 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Order information</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="col-span-2">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                Order number
              </dt>
              <dd className="font-semibold text-foreground">
                {order?.order_number ?? `PF-ORD-${order!.order_id}`}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Order date</dt>
              <dd className="text-foreground">{formatDate(order!.created_at)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                Delivery destination
              </dt>
              <dd className="text-foreground">{order!.address}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                Payment method
              </dt>
              <dd className="text-foreground capitalize">{order!.payment_method}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                Payment status
              </dt>
              <dd
                className={cn(
                  "font-semibold",
                  order!.is_paid ? "text-success" : "text-muted-foreground",
                )}
              >
                {order!.is_paid ? "Paid" : "Awaiting payment"}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                Current status
              </dt>
              <dd className="font-semibold text-foreground capitalize">{order!.status}</dd>
            </div>
          </dl>

          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Ordered products ({order!.items.length})
            </h3>
            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {order!.items.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No items.</p>
              ) : (
                order!.items.map((item) => (
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
            <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/60 p-4">
              <span className="font-semibold text-foreground">Grand total:</span>
              <span className="font-display text-xl font-bold text-primary">
                {etb(order!.total)}
              </span>
            </div>
          </div>
        </div>

        {/* Delivery */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Delivery</h2>
          <p className="text-sm text-muted-foreground mb-4">{order!.address}</p>
          {delivery && (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Expected delivery</dt>
                <dd className="text-foreground">{delivery.expected_delivery_date ?? "Not set"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Assigned staff</dt>
                <dd className="text-foreground">{delivery.assigned_name ?? "Unassigned"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Dispatched</dt>
                <dd className="text-foreground">{delivery.dispatched_at ?? "Not dispatched"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivered</dt>
                <dd className="text-foreground">{delivery.delivered_at ?? "Not delivered"}</dd>
              </div>
            </dl>
          )}
          {!delivery && (
            <p className="text-xs text-muted-foreground italic">
              Delivery details not yet available.
            </p>
          )}
        </div>

        {/* Messages */}
        <div className="lg:col-span-4 rounded-xl border border-border bg-card p-6 flex flex-col">
          <h2 className="text-lg font-semibold text-foreground mb-4">Messages with our team</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Reply to our team about this order. No account needed — your message is tied to this
            verified order only.
          </p>
          <div className="flex-1 min-h-[200px] overflow-y-auto space-y-3 border-b border-border pb-4">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No messages yet.</p>
            ) : (
              messages.map((m) => {
                const mine = m.sender_type === "customer";
                return (
                  <div
                    key={m.id}
                    className={cn("flex flex-col", mine ? "items-end" : "items-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        mine
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground border border-border/60",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-xs">
                          {mine ? "You" : m.sender_name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(m.created_at)}
                        </span>
                      </div>
                      {m.kind !== "message" && m.status_to ? (
                        <span className="text-[10px] uppercase tracking-wide text-primary">
                          {m.status_from} → {m.status_to}
                        </span>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{m.body ?? ""}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <form noValidate className="mt-2 space-y-2" onSubmit={onSendMessage}>
            <div>
              <Label htmlFor="order-message" className="sr-only">
                Your message
              </Label>
              <Textarea
                id="order-message"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type your reply…"
                rows={3}
                maxLength={2000}
                disabled={sending}
                required
                className="w-full"
              />
            </div>
            <Button type="submit" disabled={sending || !messageInput.trim()} className="w-full">
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
