import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { etb } from "@/shared/data";
import { useStore } from "@/frontend/store";
import { useServerFn } from "@tanstack/react-start";
import { placeOrder as placeOrderFn } from "@/backend/api.functions";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Your Cart — Polar Fiber" },
      { name: "description", content: "Review your items and place your order." },
      { property: "og:title", content: "Your Cart — Polar Fiber" },
      { property: "og:description", content: "Review and confirm your Polar Fiber order." },
    ],
  }),
  component: Cart,
});

function Cart() {
  const { cart, products, setCartQty, user, clearCart } = useStore();
  const placeOrder = useServerFn(placeOrderFn);
  const [busy, setBusy] = useState(false);
  const [address, setAddress] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const nav = useNavigate();
  const lines = cart
    .map((c) => ({ ...c, p: products.find((p) => p.product_id === c.product_id) }))
    .filter((l) => l.p);
  const total = lines.reduce((t, l) => t + l.p!.price * l.quantity, 0);
  const isGuest = !user;

  if (lines.length === 0)
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-3xl font-bold">Your cart is empty</h1>
        <Button asChild className="mt-6">
          <Link to="/products">Browse products</Link>
        </Button>
      </div>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) {
      toast.error("Please enter a delivery address.");
      return;
    }
    if (isGuest) {
      if (!guestName.trim()) { toast.error("Please enter your name."); return; }
      if (!guestEmail.trim()) { toast.error("Please enter your email."); return; }
      if (!guestPhone.trim()) { toast.error("Please enter your phone."); return; }
      if (!accessPassword.trim() || accessPassword.length < 6) {
        toast.error("Please set a password (min 6 characters) to track your order.");
        return;
      }
    }
    setBusy(true);
    try {
      const payload: {
        address: string;
        items: typeof cart;
        name?: string;
        email?: string;
        phone?: string;
        access_password?: string;
      } = { address: address.trim(), items: cart };

      if (isGuest) {
        payload.name = guestName.trim();
        payload.email = guestEmail.trim();
        payload.phone = guestPhone.trim();
        payload.access_password = accessPassword;
      }

      const o = await placeOrder({ data: payload });
      clearCart();
      if (isGuest) {
        toast.success("Order placed! Use your order number and password to track it.");
        nav({ to: "/track-order" });
      } else {
        toast.success(`Order #${o.order_id} placed!`);
        nav({ to: "/admin" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not place order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h1 className="text-4xl font-bold">Your cart</h1>
        <div className="mt-6 divide-y rounded-xl border bg-card">
          {lines.map((l) => (
            <div key={l.product_id} className="flex items-center gap-4 p-4">
              <img src={l.p!.image} alt="" className="h-16 w-20 rounded-md object-cover" />
              <div className="flex-1">
                <p className="font-semibold">{l.p!.name}</p>
                <p className="text-sm text-muted-foreground">{etb(l.p!.price)}</p>
              </div>
              <Input
                type="number"
                min={1}
                value={l.quantity}
                onChange={(e) => setCartQty(l.product_id, Number(e.target.value))}
                className="w-20"
              />
              <button
                onClick={() => setCartQty(l.product_id, 0)}
                aria-label="Remove"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="h-fit rounded-xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Total</p>
        <p className="font-display text-3xl font-bold text-primary">{etb(total)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Payment on delivery. Our team will call to confirm.
        </p>

        <form className="mt-6 space-y-3" onSubmit={submit}>
          {isGuest && (
            <>
              <div>
                <Label htmlFor="guest-name">Full name</Label>
                <Input
                  id="guest-name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>
              <div>
                <Label htmlFor="guest-email">Email</Label>
                <Input
                  id="guest-email"
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  maxLength={255}
                  required
                />
              </div>
              <div>
                <Label htmlFor="guest-phone">Phone</Label>
                <Input
                  id="guest-phone"
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  maxLength={30}
                  placeholder="+251..."
                  required
                />
              </div>
              <div>
                <Label htmlFor="access-password">Track order password</Label>
                <Input
                  id="access-password"
                  type="password"
                  value={accessPassword}
                  onChange={(e) => setAccessPassword(e.target.value)}
                  maxLength={100}
                  placeholder="Min 6 characters"
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Save this password to track your order later.
                </p>
              </div>
            </>
          )}
          <div>
            <Label htmlFor="address">Delivery address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={200}
              placeholder="Sub-city, Addis Ababa"
              required
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Placing..." : "Place order"}
          </Button>
        </form>

        {isGuest && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
