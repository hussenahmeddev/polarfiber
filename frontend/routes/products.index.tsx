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
  const { products } = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [sort, setSort] = useState("default");
  const list = products
    .filter(
      (p) =>
        (cat === "All" || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "low" ? a.price - b.price : sort === "high" ? b.price - a.price : sort === "name" ? a.name.localeCompare(b.name) : 0,
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
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <ProductCard key={p.product_id} p={p} />
        ))}
      </div>
      {list.length === 0 && (
        <p className="mt-10 text-muted-foreground">No products match your search.</p>
      )}
    </div>
  );
}
