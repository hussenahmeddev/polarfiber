import { createFileRoute } from "@tanstack/react-router";
import {
  Wrench,
  Truck,
  ShieldCheck,
  Box,
  Settings,
  PhoneCall,
  LayoutGrid,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/frontend/components/ui/button";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services — Polar Fiber" },
      {
        name: "description",
        content:
          "Polar Fiber provides installation support, delivery, warranty service, custom manufacturing, maintenance guidance, and customer support for water storage solutions.",
      },
      { property: "og:title", content: "Services — Polar Fiber" },
      {
        property: "og:description",
        content: "Comprehensive services for your water storage needs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Services,
});

const services = [
  {
    icon: Wrench,
    title: "Installation Support",
    description:
      "Professional guidance and support for proper installation of your water storage tanks, ensuring optimal performance and longevity.",
    features: [
      "On-site assessment and planning",
      "Foundation preparation guidance",
      "Connection and plumbing support",
      "Post-installation inspection",
    ],
  },
  {
    icon: Truck,
    title: "Delivery Services",
    description:
      "We coordinate delivery of your products to your location across Ethiopia. Contact us to discuss delivery options for your area.",
    features: [
      "Nationwide delivery coverage",
      "Scheduled delivery windows",
      "Safe loading and transport",
      "Delivery tracking available",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Warranty Service",
    description:
      "Our water tank products come with a 10-year manufacturer's warranty. We stand behind the quality and durability of our products.",
    features: [
      "10-year comprehensive warranty",
      "Manufacturing defect coverage",
      "Easy claim process",
      "Dedicated warranty support team",
    ],
  },
  {
    icon: Box,
    title: "Custom Manufacturing",
    description:
      "Need a specific size or configuration? We offer custom manufacturing options for specialized requirements.",
    features: [
      "Custom tank capacities",
      "Specialized fittings and outlets",
      "Color and branding options",
      "Prototype development",
    ],
  },
  {
    icon: Settings,
    title: "Maintenance Guidance",
    description:
      "We provide maintenance information and support to help you keep your water storage system in optimal condition.",
    features: [
      "Regular cleaning schedules",
      "Inspection checklists",
      "Seasonal care instructions",
      "Spare parts availability",
    ],
  },
  {
    icon: PhoneCall,
    title: "Customer Support",
    description:
      "Our team is available to answer your questions, help you choose the right product, and provide after-sales assistance.",
    features: [
      "Pre-purchase consultation",
      "Product selection guidance",
      "Technical troubleshooting",
      "After-sales follow-up",
    ],
  },
];

const qualityFeatures = [
  {
    number: "01",
    icon: CheckCircle2,
    title: "100% Food-Grade Material",
    details: [
      "Made from UV-stabilized, non-toxic LLDPE plastic (BPA-free)",
      "Certified safe for drinking water storage — no chemical leaching or contamination",
    ],
  },
  {
    number: "02",
    icon: Layers,
    title: "Ultra-Durable & Weatherproof",
    details: [
      "UV-resistant to prevent cracking, fading, or brittleness under sunlight",
      "Withstands extreme temperatures (–10°C to 60°C) without warping",
    ],
  },
  {
    number: "03",
    icon: LayoutGrid,
    title: "Leak-Proof & Airtight",
    details: [
      "Seamless rotomolded construction — no weak joints or cracks",
      "Secure locking lid keeps out dirt, insects, and pollutants",
    ],
  },
];

function Services() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="reference-hero">
        <img
          className="reference-hero-photo"
          src="/images/tanks.jpg"
          alt="Polar Fiber water tankers"
          fetchPriority="high"
        />
        <div className="reference-hero-inner">
          <div className="reference-hero-copy">
            <h1>
              <span>Polar Fiber</span>Our Services
            </h1>
            <p>
              Beyond manufacturing quality products, Polar Fiber provides comprehensive support
              services to ensure you get the most from your water storage solutions.
            </p>
            <div className="reference-call">
              <p>Polar Fiber—Where quality meets every drop.</p>
              <a href="tel:+251911752298">+251 911 75 22 98</a>
            </div>
          </div>
        </div>
      </section>

      <section className="reference-section reference-services-section">
        <div className="reference-services-heading">
          <h2>Support Services</h2>
          <p className="reference-body">
            From installation to long-term maintenance, we're with you every step of the way.
          </p>
        </div>
        <div className="reference-services-grid">
          {services.map((s) => (
            <article key={s.title} className="reference-service-card">
              <div className="reference-service-icon">
                <s.icon aria-hidden="true" />
              </div>
              <h3>{s.title}</h3>
              <p className="reference-body">{s.description}</p>
              <ul className="mt-4 space-y-2" role="list">
                {s.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="reference-quality">
        <div className="reference-section">
          <div className="reference-quality-heading">
            <p className="reference-eyebrow">Our Products</p>
            <h2>Main Quality and Features</h2>
          </div>
          <div className="reference-features">
            {qualityFeatures.map((f) => (
              <article key={f.title} className="relative">
                <span className="absolute -top-4 left-0 text-3xl font-bold text-primary/20">
                  {f.number}
                </span>
                <div className="flex items-start gap-4">
                  <div className="reference-service-icon flex-shrink-0">
                    <f.icon aria-hidden="true" />
                  </div>
                  <div>
                    <h3>{f.title}</h3>
                    <ul className="mt-3 space-y-2">
                      {f.details.map((d, i) => (
                        <li key={i} className="reference-body flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="reference-cta">
        <div className="reference-cta-inner">
          <div>
            <h2>Your water storage solutions start here!</h2>
            <p>
              From pre-purchase advice to long-term maintenance, our specialists ensure you get the
              right tank and the right peace of mind.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Button asChild variant="secondary" size="lg" className="rounded-none">
              <a href="tel:+251911752298">+251 911 75 22 98</a>
            </Button>
            <Button asChild size="lg">
              <Link to="/quote">Request a Quote</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
