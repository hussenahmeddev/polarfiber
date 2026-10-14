import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapPin, Phone, Globe } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Textarea } from "@/frontend/components/ui/textarea";
import { useStore } from "@/frontend/store";
import { useServerFn } from "@tanstack/react-start";
import { submitContactMessage as submitContactMessageFn } from "@/backend/api.functions";

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

const EMPTY = { name: "", email: "", phone: "", subject: "", message: "" };

function Contact() {
  const { user } = useStore();
  const send = useServerFn(submitContactMessageFn);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) setF((x) => ({ ...x, name: x.name || user.name, email: x.email || user.email }));
  }, [user]);

  const set =
    (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF({ ...f, [k]: e.target.value });

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

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-2xl font-bold">Send us a message</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We usually reply within one working day. You'll also find our team on +251 911 75 22 98.
          </p>
          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!f.name.trim() || !f.email.trim() || !f.subject.trim() || !f.message.trim()) {
                toast.error("Please fill in your name, email, subject and message.");
                return;
              }
              if (!/^\S+@\S+\.\S+$/.test(f.email)) {
                toast.error("Please enter a valid email address.");
                return;
              }
              setBusy(true);
              try {
                await send({
                  data: {
                    name: f.name,
                    email: f.email,
                    phone: f.phone.trim() || undefined,
                    subject: f.subject,
                    message: f.message,
                  },
                });
              } catch {
                toast.error("Could not send your message. Please try again or call us.");
                return;
              } finally {
                setBusy(false);
              }
              toast.success("Message sent! Our team will get back to you shortly.");
              setF({ name: user?.name ?? "", email: user?.email ?? "", phone: "", subject: "", message: "" });
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="contact-name">Your name</Label>
                <Input
                  id="contact-name"
                  value={f.name}
                  onChange={set("name")}
                  maxLength={100}
                  required
                />
              </div>
              <div>
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={f.email}
                  onChange={set("email")}
                  maxLength={255}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="contact-phone">Phone (optional)</Label>
              <Input
                id="contact-phone"
                type="tel"
                value={f.phone}
                onChange={set("phone")}
                maxLength={30}
                placeholder="+251..."
              />
            </div>
            <div>
              <Label htmlFor="contact-subject">Subject</Label>
              <Input
                id="contact-subject"
                value={f.subject}
                onChange={set("subject")}
                maxLength={150}
                required
              />
            </div>
            <div>
              <Label htmlFor="contact-message">How may we help you?</Label>
              <Textarea
                id="contact-message"
                rows={5}
                value={f.message}
                onChange={set("message")}
                maxLength={2000}
                required
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? "Sending…" : "Send message"}
            </Button>
          </form>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-2xl font-bold">Business hours</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Monday – Friday</dt>
              <dd className="font-semibold">8:00 – 17:00</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Saturday</dt>
              <dd className="font-semibold">8:00 – 13:00</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Sunday</dt>
              <dd className="font-semibold">Closed</dd>
            </div>
          </dl>
          <p className="mt-6 text-sm text-muted-foreground">
            Need a price first? Request a free quote and we'll reply with an amount.
          </p>
          <Button asChild variant="outline" className="mt-3">
            <Link to="/quote">Request a quote</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
