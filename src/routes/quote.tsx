import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/quote")({
  head: () => ({
    meta: [
      { title: "Request a Free Quote — Polar Fiber" },
      { name: "description", content: "Tell us what you need and Polar Fiber will reply with a price." },
      { property: "og:title", content: "Request a Free Quote — Polar Fiber" },
      { property: "og:description", content: "Free quotes on water tankers and plastic products." },
    ],
  }),
  component: QuotePage,
});

function QuotePage() {
  const { submitQuote, user } = useStore();
  const [f, setF] = useState({ name: "", email: "", subject: "", message: "" });
  useEffect(() => { if (user) setF((x) => ({ ...x, name: x.name || user.name, email: x.email || user.email })); }, [user]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-4xl font-bold">Request a free quote</h1>
      <p className="mt-2 text-muted-foreground">We usually reply within one working day.</p>
      <form className="mt-8 space-y-4 rounded-xl border bg-card p-6" onSubmit={(e) => {
        e.preventDefault();
        if (!f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email) || !f.subject.trim() || !f.message.trim()) { toast.error("Please fill in all fields with a valid email."); return; }
        submitQuote(f); toast.success("Quote request sent!"); setF({ name: user?.name ?? "", email: user?.email ?? "", subject: "", message: "" });
      }}>
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>Your name</Label><Input value={f.name} onChange={set("name")} maxLength={100} /></div>
          <div><Label>Email</Label><Input type="email" value={f.email} onChange={set("email")} maxLength={255} /></div>
        </div>
        <div><Label>Subject</Label><Input value={f.subject} onChange={set("subject")} maxLength={150} /></div>
        <div><Label>How may we help you?</Label><Textarea rows={5} value={f.message} onChange={set("message")} maxLength={2000} /></div>
        <Button type="submit" size="lg" className="w-full">Get a quote</Button>
      </form>
    </div>
  );
}
