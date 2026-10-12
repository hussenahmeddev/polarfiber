import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/frontend/components/ui/button";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  MessageSquare,
  HelpCircle,
  ShieldCheck,
  Wrench,
  FileText,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/support")({
  head: () => ({
    meta: [
      { title: "Customer Support — Polar Fiber" },
      {
        name: "description",
        content: "Direct contact with Polar Fiber engineering and sales teams.",
      },
    ],
  }),
  component: DashboardSupportPage,
});

export function DashboardSupportPage() {
  const faqs = [
    {
      q: "How do I maintain my fiberglass water tanker?",
      a: "Polar Fiber water tankers feature food-grade gelcoat linings that resist algae and bacterial growth. Simply flush with clean potable water once every six months. No scraping or aggressive chemicals required.",
    },
    {
      q: "What is the warranty period for roofing sheets?",
      a: "Our reinforced fiberglass corrugated sheets come with a 15-year weather and UV resistance manufacturer warranty against cracking, discolouration, and structural delamination.",
    },
    {
      q: "Can I request custom engineering specifications or nozzle fittings?",
      a: "Yes! Use our Messages tab to upload your technical specifications or blueprints, or speak directly to our engineering desk. We fabricate custom nozzles, manholes, baffles, and structural brackets.",
    },
    {
      q: "What are the standard delivery lead times within Addis Ababa & regions?",
      a: "In-stock items are dispatched within 24 to 48 hours. Custom fiberglass fabrications typically require 5 to 10 business days depending on mold preparation and resin curing schedules.",
    },
  ];

  return (
    <div className="space-y-8 max-w-4xl animate-in fade-in-50 duration-200">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Customer & Engineering Support
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Direct contact with Polar Fiber sales engineers, workshop fabrication leads, and technical helpdesk
        </p>
      </div>

      {/* Quick Action / Direct Messaging Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-xs">
              <MessageSquare className="h-3 w-3" />
              Priority In-App Messaging
            </span>
            <h2 className="text-xl font-bold">Have an ongoing order or technical question?</h2>
            <p className="text-xs text-primary-foreground/90 leading-relaxed">
              Start an asynchronous message thread with our engineering team directly inside your dashboard. Track responses, revisions, and status updates in one place.
            </p>
          </div>
          <Button
            asChild
            variant="secondary"
            className="shrink-0 bg-white text-primary hover:bg-white/90 font-semibold shadow-xs"
          >
            <Link to="/dashboard/messages">
              Open Messages
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Contact Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">Direct Sales & Helpdesk</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Direct phone line for order questions, pricing, and expedited deliveries.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-border/60">
            <p className="text-xs text-muted-foreground">Mon – Sat, 8:00 AM – 6:00 PM</p>
            <a
              href="tel:+251911234567"
              className="inline-block font-bold text-sm text-primary hover:underline mt-1"
            >
              +251 911 234 567
            </a>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">Engineering Specs Email</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Submit architectural CAD drawings, tender documents, or structural specifications.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-border/60">
            <p className="text-xs text-muted-foreground">Response within 4 business hours</p>
            <a
              href="mailto:support@polarfiber.et"
              className="inline-block font-bold text-sm text-emerald-600 hover:underline mt-1"
            >
              support@polarfiber.et
            </a>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">Factory & Showroom</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Visit our fabrication facilities to inspect finished water tankers and corrugated sheets.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-border/60">
            <p className="text-xs text-muted-foreground">Kality Industrial Zone</p>
            <p className="font-medium text-xs text-foreground mt-1">
              Addis Ababa, Ethiopia
            </p>
          </div>
        </div>
      </div>

      {/* Technical FAQ Section */}
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
        <div className="flex items-center gap-2.5 pb-2 border-b border-border">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h2 className="font-bold text-lg text-foreground">
            Frequently Asked Technical Questions
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="p-4.5 rounded-xl bg-muted/40 border border-border/50 space-y-1.5 transition-colors hover:bg-muted/60"
            >
              <h3 className="font-semibold text-foreground text-xs sm:text-sm">
                {faq.q}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Service Guarantees */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 border border-border/50">
          <ShieldCheck className="h-6 w-6 text-primary shrink-0" />
          <div>
            <p className="text-xs font-bold text-foreground">15-Year UV Warranty</p>
            <p className="text-[11px] text-muted-foreground">Engineered for extreme sun & weather</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 border border-border/50">
          <Wrench className="h-6 w-6 text-primary shrink-0" />
          <div>
            <p className="text-xs font-bold text-foreground">On-Site Installation</p>
            <p className="text-[11px] text-muted-foreground">Professional assembly available nationwide</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 border border-border/50">
          <FileText className="h-6 w-6 text-primary shrink-0" />
          <div>
            <p className="text-xs font-bold text-foreground">Certified Food-Grade</p>
            <p className="text-[11px] text-muted-foreground">ISO-compliant resin for safe drinking water</p>
          </div>
        </div>
      </div>
    </div>
  );
}
