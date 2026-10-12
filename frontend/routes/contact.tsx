import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Phone, Globe } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Polar Fiber — Call, Visit or Request a Quote" },
      {
        name: "description",
        content: "Call +251 911 75 22 98 or visit Polar Fiber at Jemoo Furi 2, Addis Ababa.",
      },
      { property: "og:title", content: "Contact Polar Fiber" },
      { property: "og:description", content: "Reach the Polar Fiber sales team in Addis Ababa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Contact,
});

function Contact() {
  const items = [
    { icon: Phone, t: "Phone", v: "+251 911 75 22 98", href: "tel:+251911752298" },
    { icon: MapPin, t: "Address", v: "Jemoo Furi 2, near Emnebered Factory, Addis Ababa" },
    { icon: Globe, t: "Website", v: "polarfiber.com.et", href: "https://polarfiber.com.et" },
  ];
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl font-bold">Contact us</h1>
      <p className="mt-3 text-muted-foreground">
        Questions about sizes, delivery or installation? We're here to help.
      </p>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {items.map((i) => (
          <div key={i.t} className="rounded-xl border bg-card p-6">
            <i.icon className="h-6 w-6 text-primary" />
            <p className="mt-3 text-sm font-semibold text-muted-foreground">{i.t}</p>
            {i.href ? (
              <a href={i.href} className="mt-1 block font-bold hover:text-primary">
                {i.v}
              </a>
            ) : (
              <p className="mt-1 font-bold">{i.v}</p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-10 overflow-hidden rounded-xl border">
        <iframe
          title="Polar Fiber location"
          src="https://www.google.com/maps?q=Jemo+Addis+Ababa&output=embed"
          className="h-80 w-full"
          loading="lazy"
        />
      </div>
      <Button asChild size="lg" className="mt-8">
        <Link to="/quote">Send us a message</Link>
      </Button>
    </div>
  );
}
