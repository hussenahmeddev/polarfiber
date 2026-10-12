import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/frontend/components/ui/input";
import { ProductCard } from "@/frontend/components/ProductCard";
import { CATEGORIES } from "@/shared/data";
import { useStore } from "@/frontend/store";

export const Route = createFileRoute("/products/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Products — Polar Fiber" },
      {
        name: "description",
        content: "Water tankers, flower pots, roof sheets and fiber pipes from Polar Fiber.",
      },
      { property: "og:title", content: "Products — Polar Fiber" },
      { property: "og:description", content: "Search and filter the full Polar Fiber catalog." },
    ],
  }),
  component: Products,
});

function Products() {
  const { products, productsLoading, productsError } = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [sort, setSort] = useState("default");
  const list = products
    .filter(
      (p) =>
        (cat === "All" || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "low"
        ? a.price - b.price
        : sort === "high"
          ? b.price - a.price
          : sort === "name"
            ? a.name.localeCompare(b.name)
            : 0,
    );
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl font-bold">Our products</h1>
      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {["All", ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium ${cat === c ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort products"
          className="h-9 rounded-md border bg-card px-3 text-sm md:ml-auto"
        >
          <option value="default">Featured</option>
          <option value="low">Price: low to high</option>
          <option value="high">Price: high to low</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      {productsError && (
        <div className="mt-8 rounded-xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-700 dark:text-rose-300">
          <p className="font-semibold">Unable to load products from database</p>
          <p className="mt-1 text-xs text-rose-600/90 dark:text-rose-300/80">
            Please make sure database environment variables (<code className="rounded bg-rose-500/20 px-1 py-0.5">MYSQL_HOST</code>, <code className="rounded bg-rose-500/20 px-1 py-0.5">MYSQL_PASSWORD</code>, <code className="rounded bg-rose-500/20 px-1 py-0.5">MYSQL_CA_CERT</code>, etc.) are configured in your Vercel Project Settings.
          </p>
        </div>
      )}

      {productsLoading ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border bg-card p-4">
              <div className="aspect-[4/3] rounded-lg bg-muted" />
              <div className="mt-4 h-4 w-1/3 rounded bg-muted" />
              <div className="mt-2 h-5 w-2/3 rounded bg-muted" />
              <div className="mt-4 flex justify-between">
                <div className="h-5 w-1/4 rounded bg-muted" />
                <div className="h-4 w-1/4 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <ProductCard key={p.product_id} p={p} />
            ))}
          </div>
          {!productsError && list.length === 0 && (
            <p className="mt-10 text-muted-foreground">No products match your search.</p>
          )}
        </>
      )}
    </div>
  );
}
