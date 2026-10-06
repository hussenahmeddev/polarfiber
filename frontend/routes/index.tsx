import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Sun, Lock, Phone, ArrowRight } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { QuoteForm } from "@/frontend/components/QuoteForm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Polar Fiber — Water Tankers with a 10-Year Warranty" },
      { name: "description", content: "Durable, food-grade water storage solutions for homes, farms and industry. Explore Polar Fiber products and request a free quote in Addis Ababa." },
      { property: "og:title", content: "Polar Fiber — Water Tankers with a 10-Year Warranty" },
      { property: "og:description", content: "Quality water tankers and plastic products from Polar Fiber, Addis Ababa. Request a free quote." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const features = [
  { icon: ShieldCheck, title: "100% Food-Grade Material", text: "UV-stabilized, non-toxic LLDPE plastic. BPA-free and safe for drinking water storage." },
  { icon: Sun, title: "Ultra-Durable & Weatherproof", text: "UV-resistant construction that withstands temperatures from –10°C to 60°C without cracking or warping." },
  { icon: Lock, title: "Leak-Proof & Airtight", text: "A seamless rotomolded body and secure locking lid keep out dirt, insects and pollutants." },
];
const photos = [
  { src: "/images/tanks.jpg", alt: "Polar Fiber water tanks at the factory" },
  { src: "/images/product-2.jpg", alt: "Large Polar Fiber water storage tank" },
  { src: "/images/product-3.jpg", alt: "Polar Fiber tank with a secure lid" },
  { src: "/images/product-4.jpg", alt: "Polar Fiber manufactured plastic products" },
  { src: "/images/product-5.jpg", alt: "Water storage products from Polar Fiber" },
  { src: "/images/product-6.jpg", alt: "Polar Fiber factory product range" },
];

function Home() {
  return (
    <>
      <section className="reference-hero">
        <img className="reference-hero-photo" src="/images/tanks.jpg" alt="Polar Fiber water tankers" fetchPriority="high" />
        <div className="reference-hero-inner">
          <div className="reference-hero-copy">
            <h1><span>Polar Fiber</span>We give 10 years warranty for our water tanker product.</h1>
            <p>Our vision is to become a leading innovator in water storage technology, ensuring every customer has access to affordable, high-capacity, and eco-friendly solutions.</p>
            <div className="reference-call">
              <p>Polar Fiber—Where quality meets every drop.</p>
              <a href="tel:+251911752298"><Phone aria-hidden="true" />+251 911 75 22 98</a>
            </div>
          </div>
          <QuoteForm />
        </div>
      </section>
      <section className="reference-section reference-about">
        <div>
          <p className="reference-eyebrow">About us</p>
          <h2>We are a group of professional sellers</h2>
          <div className="reference-rule" />
          <p className="reference-body">At Polar Fiber, we are committed to delivering premium-quality, durable, and safe water storage solutions for homes, industries, and agricultural needs. Our rotomolded and blow-molded plastic water tankers are built for hygiene, strength, and longevity.</p>
          <p className="reference-body mt-4">Reliable water storage that withstands harsh climates while keeping your water pure. Made locally in Addis Ababa, built to last.</p>
          <Button asChild className="reference-button mt-6"><Link to="/about">Read more <ArrowRight /></Link></Button>
        </div>
        <img className="reference-about-photo" src="/images/tank.png" alt="Polar Fiber white water tanker" loading="lazy" />
      </section>
      <section className="reference-section reference-gallery-section">
        <div className="reference-gallery-heading">
          <h2>Our products</h2>
          <Button asChild variant="link" className="px-0"><Link to="/products">View catalog <ArrowRight /></Link></Button>
        </div>
        <div className="reference-gallery">
          {photos.map(photo => <Link to="/products" key={photo.src} aria-label={`Browse products: ${photo.alt}`}><img src={photo.src} alt={photo.alt} loading="lazy" /></Link>)}
        </div>
      </section>
      <section className="reference-quality">
        <div className="reference-section">
          <div className="reference-quality-heading"><p className="reference-eyebrow">Our products</p><h2>Main quality and features</h2></div>
          <div className="reference-features">
            {features.map(f => <article key={f.title}><f.icon aria-hidden="true" /><h3>{f.title}</h3><p className="reference-body">{f.text}</p></article>)}
          </div>
        </div>
      </section>
      <section className="reference-cta">
        <div className="reference-cta-inner">
          <div><h2>Your water storage solutions start here!</h2><p>From pre-purchase advice to long-term maintenance, our specialists help you choose the right tank and the right peace of mind.</p></div>
          <Button asChild variant="secondary" size="lg" className="rounded-none"><a href="tel:+251911752298"><Phone />+251 911 75 22 98</a></Button>
        </div>
      </section>
    </>
  );
}
