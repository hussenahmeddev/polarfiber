import { createFileRoute, Link } from "@tanstack/react-router";
import { Factory, Wrench, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Polar Fiber — Water Storage Manufacturer, Addis Ababa" },
      {
        name: "description",
        content:
          "Polar Fiber manufactures rotomolded and blow-molded water storage products in Addis Ababa, Ethiopia.",
      },
      { property: "og:title", content: "About Polar Fiber" },
      {
        property: "og:description",
        content: "Ethiopian manufacturer of durable, food-grade water storage products.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: About,
});

const values = [
  { icon: ShieldCheck, t: "Food-grade materials", d: "Hygienic storage safe for drinking water." },
  {
    icon: Factory,
    t: "Local manufacturing",
    d: "Made at our factory in Jemoo Furi 2, Addis Ababa.",
  },
  { icon: Sparkles, t: "Customizable", d: "Sizes and options for homes, farms and industry." },
  { icon: Wrench, t: "After-sales support", d: "Installation help and a 10-year tanker warranty." },
];

function About() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl font-bold">About Polar Fiber</h1>
      <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
        Polar Fiber manufactures and sells rotomolded and blow-molded plastic water storage products
        and related plastic and fiber products, serving residential, agricultural, commercial and
        industrial customers across Ethiopia.
      </p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {values.map((v) => (
          <div key={v.t} className="rounded-xl border bg-card p-6">
            <v.icon className="h-7 w-7 text-primary" />
            <h2 className="mt-3 font-bold">{v.t}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{v.d}</p>
          </div>
        ))}
      </div>
      <Button asChild size="lg" className="mt-10">
        <Link to="/contact">Talk to our team</Link>
      </Button>
    </div>
  );
}
