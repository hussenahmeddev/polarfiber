import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { etb } from "@/lib/data";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Cart — Polar Fiber" },
      { name: "description", content: "Review your items and place your order." },
      { property: "og:title", content: "Your Cart — Polar Fiber" },
      { property: "og:description", content: "Review and confirm your Polar Fiber order." },
    ],
  }),
  component: Cart,
});

function Cart() {
  const { cart, products, setCartQty, user, placeOrder } = useStore();
  const [address, setAddress] = useState("");
  const nav = useNavigate();
  const lines = cart.map((c) => ({ ...c, p: products.find((p) => p.product_id === c.product_id) })).filter((l) => l.p);
  const total = lines.reduce((t, l) => t + l.p!.price * l.quantity, 0);

  if (lines.length === 0) return <div className="mx-auto max-w-3xl px-4 py-20 text-center"><h1 className="text-3xl font-bold">Your cart is empty</h1><Button asChild className="mt-6"><Link to="/products">Browse products</Link></Button></div>;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h1 className="text-4xl font-bold">Your cart</h1>
        <div className="mt-6 divide-y rounded-xl border bg-card">
          {lines.map((l) => (
            <div key={l.product_id} className="flex items-center gap-4 p-4">
              <img src={l.p!.image} alt="" className="h-16 w-20 rounded-md object-cover" />
              <div className="flex-1"><p className="font-semibold">{l.p!.name}</p><p className="text-sm text-muted-foreground">{etb(l.p!.price)}</p></div>
              <Input type="number" min={1} value={l.quantity} onChange={(e) => setCartQty(l.product_id, Number(e.target.value))} className="w-20" />
              <button onClick={() => setCartQty(l.product_id, 0)} aria-label="Remove" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </div>
      <div className="h-fit rounded-xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">Total</p>
        <p className="font-display text-3xl font-bold text-primary">{etb(total)}</p>
        <p className="mt-1 text-xs text-muted-foreground">Payment on delivery. Our team will call to confirm.</p>
        {user ? (
          <form className="mt-6 space-y-3" onSubmit={(e) => {
            e.preventDefault();
            if (!address.trim()) { toast.error("Please enter a delivery address."); return; }
            const o = placeOrder(address.trim());
            if (o) { toast.success(`Order #${o.order_id} placed!`); nav({ to: "/account" }); }
          }}>
            <div><Label>Delivery address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} placeholder="Sub-city, Addis Ababa" /></div>
            <Button type="submit" size="lg" className="w-full">Place order</Button>
          </form>
        ) : (
          <Button asChild size="lg" className="mt-6 w-full"><Link to="/login">Sign in to order</Link></Button>
        )}
      </div>
    </div>
  );
}
