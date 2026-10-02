import { Link } from "@tanstack/react-router";
import { etb, type Product } from "@/lib/data";

export function ProductCard({ p }: { p: Product }) {
  return (
    <Link to="/products/$id" params={{ id: String(p.product_id) }}
      className="group overflow-hidden rounded-xl border bg-card shadow-soft transition hover:-translate-y-1">
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
      </div>
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-foreground/60">{p.category}</p>
        <h3 className="mt-1 font-semibold">{p.name}</h3>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-display font-bold text-primary">{etb(p.price)}</span>
          <span className={`text-xs font-medium ${p.stock > 0 ? "text-success" : "text-warning"}`}>{p.stock > 0 ? `${p.stock} in stock` : "Made to order"}</span>
        </div>
      </div>
    </Link>
  );
}
