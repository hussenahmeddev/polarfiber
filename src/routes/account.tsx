import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { etb } from "@/lib/data";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My Account — Polar Fiber" },
      { name: "description", content: "Your Polar Fiber orders and quote requests." },
      { property: "og:title", content: "My Account — Polar Fiber" },
      { property: "og:description", content: "Track your orders and quotes." },
    ],
  }),
  component: Account,
});

function Account() {
  const { user, orders, quotes, products, logout } = useStore();
  const nav = useNavigate();
  if (!user) return <div className="mx-auto max-w-md px-4 py-20 text-center"><p>Please sign in to see your account.</p><Button asChild className="mt-4"><Link to="/login">Sign in</Link></Button></div>;
  const mine = orders.filter((o) => o.user_id === user.user_id);
  const myQuotes = quotes.filter((q) => q.user_id === user.user_id || q.email === user.email);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center justify-between">
        <div><h1 className="text-4xl font-bold">Hello, {user.name}</h1><p className="text-muted-foreground">{user.email} · {user.phone}</p></div>
        <Button variant="outline" onClick={() => { logout(); nav({ to: "/" }); }}>Sign out</Button>
      </div>
      <h2 className="mt-10 text-2xl font-bold">My orders</h2>
      <div className="mt-4 space-y-3">
        {mine.length === 0 && <p className="text-muted-foreground">No orders yet.</p>}
        {mine.map((o) => (
          <div key={o.order_id} className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between"><p className="font-semibold">Order #{o.order_id} · {o.created_at}</p><StatusBadge s={o.status} /></div>
            <p className="mt-1 text-sm text-muted-foreground">{o.items.map((i) => `${i.quantity} × ${products.find((p) => p.product_id === i.product_id)?.name ?? "Product"}`).join(", ")}</p>
            <p className="mt-2 font-display font-bold text-primary">{etb(o.total)}</p>
          </div>
        ))}
      </div>
      <h2 className="mt-10 text-2xl font-bold">My quote requests</h2>
      <div className="mt-4 space-y-3">
        {myQuotes.length === 0 && <p className="text-muted-foreground">No quote requests yet.</p>}
        {myQuotes.map((q) => (
          <div key={q.quote_id} className="flex items-center justify-between rounded-xl border bg-card p-4">
            <div><p className="font-semibold">{q.subject}</p><p className="text-sm text-muted-foreground">{q.created_at}</p></div><StatusBadge s={q.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
