import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Sun, Lock, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { useStore } from "@/lib/store";

const HERO = "https://polarfiber.com.et/wp-content/uploads/2025/06/IMG_0110-scaled.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Polar Fiber — Water Tankers with a 10-Year Warranty" },
      { name: "description", content: "Food-grade rotomolded water tankers from 500L to 25,000L. Browse, request a quote and order online." },
      { property: "og:title", content: "Polar Fiber — Water Tankers with a 10-Year Warranty" },
      { property: "og:description", content: "Browse tankers, pots, pipes and roof sheets and order online from Polar Fiber, Addis Ababa." },
      { property: "og:image", content: HERO },
      { name: "twitter:image", content: HERO },
    ],
  }),
  component: Home,
});

const features = [
  { icon: ShieldCheck, title: "100% Food-Grade", text: "UV-stabilized, BPA-free LLDPE, safe for drinking water." },
  { icon: Sun, title: "Weatherproof", text: "Withstands –10°C to 60°C without cracking or warping." },
  { icon: Lock, title: "Leak-Proof", text: "Seamless rotomolded body with a secure locking lid." },
];

function Home() {
  const { products } = useStore();
  return (
    <>
      <section className="relative overflow-hidden bg-water text-deep-foreground">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-2">
          <div>
            <p className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">10-year warranty</p>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight md:text-6xl">Water storage built to last.</h1>
            <p className="mt-5 max-w-md text-lg opacity-85">Durable tankers from 500L to 25,000L for homes, farms and industry — now available to browse and order online.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90"><Link to="/products">Browse products</Link></Button>
              <Button asChild size="lg" variant="outline" className="border-deep-foreground/40 bg-transparent text-deep-foreground hover:bg-deep-foreground/10"><Link to="/quote">Request a quote</Link></Button>
            </div>
          </div>
          <img src={HERO} alt="Polar Fiber water tankers" className="aspect-[4/3] w-full rounded-2xl object-cover shadow-2xl" />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-16 md:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border bg-card p-6">
            <f.icon className="h-8 w-8 text-primary" />
            <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <div className="flex items-end justify-between">
          <h2 className="text-3xl font-bold">Popular products</h2>
          <Link to="/products" className="text-sm font-semibold text-primary">View all →</Link>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.slice(0, 3).map((p) => <ProductCard key={p.product_id} p={p} />)}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-4">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-secondary p-8 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold">Your water storage solution starts here</h2>
            <p className="mt-2 text-muted-foreground">From pre-purchase advice to long-term maintenance, our specialists help you choose.</p>
          </div>
          <Button asChild size="lg"><a href="tel:+251911752298"><Phone className="h-4 w-4" />+251 911 75 22 98</a></Button>
        </div>
      </section>
    </>
  );
}
