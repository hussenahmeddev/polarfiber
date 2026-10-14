import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, ShoppingBag, CheckCircle2 } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { verifyOrderAccess, endOrderAccess, getGuestOrderStatus } from "@/backend/api.functions";
import { OrderDrawer } from "@/frontend/components/OrderDrawer";
import type { Order } from "@/shared/data";

export const Route = createFileRoute("/track-order")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Track Order — Polar Fiber" },
      {
        name: "description",
        content: "Track your order by order number, email and access password.",
      },
      { property: "og:title", content: "Track Order — Polar Fiber" },
      {
        property: "og:description",
        content: "Enter your order number, email and password to view order status.",
      },
    ],
  }),
  component: TrackOrder,
});

function TrackOrder() {
  const [form, setForm] = useState({
    order_number: "",
    email: "",
    access_password: "",
  });
  const [busy, setBusy] = useState(false);
  const [guestOrderId, setGuestOrderId] = useState<number | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  const verify = useServerFn(verifyOrderAccess);
  const fetchStatus = useServerFn(getGuestOrderStatus);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.order_number.trim() || !form.email.trim() || !form.access_password) {
      toast.error("Please enter your order number, email and password.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const result = await verify({
        data: {
          order_number: form.order_number,
          email: form.email,
          access_password: form.access_password,
        },
      });
      setGuestOrderId(result.order_id);
      setShowDrawer(true);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not find order. Check your details and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="text-center">
        <ShoppingBag className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 text-3xl font-bold">Track Your Order</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your order number, the email you used and the password you set during checkout to
          view order status and message the team.
        </p>
      </div>

      <form noValidate className="mt-8 space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="order-number">Order Number</Label>
          <Input
            id="order-number"
            value={form.order_number}
            onChange={(e) => setForm({ ...form, order_number: e.target.value })}
            placeholder="e.g. 1009 or PF-ORD-1009"
            required
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="track-email">Email</Label>
          <Input
            id="track-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
            required
          />
        </div>
        <div>
          <Label htmlFor="access-password">Access Password</Label>
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
          {busy ? "Searching..." : "Track Order"}
        </Button>
      </form>

      {guestOrderId && (
        <OrderDrawer
          order={null}
          open={showDrawer}
          onOpenChange={(open) => {
            setShowDrawer(open);
            if (!open) {
              setGuestOrderId(null);
              void endOrderAccess({});
            }
          }}
          mode="guest"
          guestOrderId={guestOrderId}
        />
      )}
    </div>
  );
}
