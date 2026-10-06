import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { etb } from "@/shared/data";
import { useStore } from "@/frontend/store";

export const Route = createFileRoute("/products/$id")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Product details — Polar Fiber" },
      { name: "description", content: "Product details, price and availability at Polar Fiber." },
      { property: "og:title", content: "Product details — Polar Fiber" },
      {
        property: "og:description",
        content: "See price, capacity and stock, then order or request a quote.",
      },
    ],
  }),
  component: ProductDetail,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const { products, addToCart } = useStore();
  const [qty, setQty] = useState(1);
  const p = products.find((x) => String(x.product_id) === id);
  if (!p)
    return (
      <div className="mx-auto max-w-6xl px-4 py-20">
        <p>Product not found.</p>
        <Link to="/products" className="text-primary">
          Back to products
        </Link>
      </div>
    );
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-2">
      <img
        src={p.image}
        alt={p.name}
        className="aspect-[4/3] w-full rounded-2xl object-cover shadow-soft"
      />
      <div>
        <Link to="/products" className="text-sm text-muted-foreground">
          ← All products
        </Link>
        <p className="mt-4 text-sm font-semibold uppercase text-muted-foreground">{p.category}</p>
        <h1 className="mt-1 text-4xl font-bold">{p.name}</h1>
        <p className="mt-4 font-display text-3xl font-bold text-primary">{etb(p.price)}</p>
        <p className="mt-4 text-muted-foreground">{p.description}</p>
        <dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl border bg-card p-4 text-sm">
          {p.capacity && (
            <div>
              <dt className="text-muted-foreground">Capacity</dt>
              <dd className="font-semibold">{p.capacity}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">Availability</dt>
            <dd className="font-semibold">
              {p.stock > 0 ? `${p.stock} in stock` : "Made to order"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Warranty</dt>
            <dd className="font-semibold">10 years</dd>
          </div>
        </dl>
        <div className="mt-6 flex gap-3">
          <Input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
            className="w-24"
          />
          <Button
            size="lg"
            onClick={() => {
              addToCart(p.product_id, qty);
              toast.success(`${p.name} added to cart`);
            }}
          >
            Add to cart
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/quote">Request quote</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
