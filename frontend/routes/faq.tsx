import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/frontend/utils";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Polar Fiber Water Tanks" },
      {
        name: "description",
        content:
          "Answers to common questions about Polar Fiber water tanks, warranties, delivery, installation, and more.",
      },
      { property: "og:title", content: "FAQ — Polar Fiber" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FAQ,
});

const faqs = [
  {
    question: "What warranty do Polar Fiber water tanks come with?",
    answer:
      "All Polar Fiber water tanker products come with a 10-year manufacturer's warranty. We stand behind the quality and durability of every tank we produce.",
  },
  {
    question: "Are Polar Fiber tanks safe for drinking water?",
    answer:
      "Yes. Our tanks are made from UV-stabilized, food-grade LLDPE plastic that is 100% BPA-free and non-toxic, making them fully safe for storing drinking water.",
  },
  {
    question: "Do you deliver to locations outside Addis Ababa?",
    answer:
      "We coordinate deliveries across Ethiopia. Contact us directly to discuss delivery options, logistics, and pricing for your specific location.",
  },
  {
    question: "Can I get a custom tank size?",
    answer:
      "Absolutely. We offer custom manufacturing options for specific sizes and configurations. Reach out to our team to discuss your requirements and get a tailored quote.",
  },
  {
    question: "How do I install a Polar Fiber water tank?",
    answer:
      "Our team provides professional installation guidance and support to ensure your tank is set up correctly for optimal performance and longevity. Contact us after purchase to arrange installation support.",
  },
  {
    question: "What temperature range can the tanks withstand?",
    answer:
      "Our UV-resistant tanks are built to withstand temperatures from –10°C to 60°C without cracking, warping, or degrading — ideal for Ethiopia's diverse climate conditions.",
  },
  {
    question: "How do I maintain my water tank?",
    answer:
      "We recommend cleaning the tank every 6–12 months with a mild disinfectant solution, keeping the lid securely closed at all times, and inspecting fittings periodically for any leaks. Our team can provide detailed maintenance guidance on request.",
  },
  {
    question: "How do I request a quote?",
    answer:
      "You can fill out the quick quote form on our homepage, visit the Request a Quote page, or call us directly at +251 911 75 22 98. We'll get back to you promptly with pricing.",
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="faq-item border-b last:border-b-0">
      <button
        type="button"
        className="faq-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{question}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn("faq-chevron", open && "rotate-180")}
        />
      </button>
      {open && <div className="faq-answer reference-body">{answer}</div>}
    </div>
  );
}

function FAQ() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <p className="reference-eyebrow text-primary mb-2">FAQ</p>
      <h1 className="text-4xl font-bold mb-3">Frequently Asked Questions</h1>
      <p className="reference-body mb-10">
        Have questions about our products or services? Find quick answers below, or{" "}
        <a href="/contact" className="text-primary underline underline-offset-4">
          contact our team
        </a>{" "}
        for anything not covered here.
      </p>
      <div className="faq-list border rounded-lg overflow-hidden">
        {faqs.map((f) => (
          <FAQItem key={f.question} question={f.question} answer={f.answer} />
        ))}
      </div>
    </div>
  );
}
