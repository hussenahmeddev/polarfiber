import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitQuote } from "@/backend/api.functions";
import { useStore } from "@/frontend/store";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Textarea } from "@/frontend/components/ui/textarea";

export function QuoteForm() {
  const { user } = useStore();
  const send = useServerFn(submitQuote);
  const [fields, setFields] = useState({ name: "", email: "", subject: "", message: "" });
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (user) setFields((f) => ({ ...f, name: f.name || user.name, email: f.email || user.email }));
  }, [user]);
  return (
    <form
      className="home-quote"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending) return;
        setPending(true);
        setStatus("");
        try {
          await send({ data: fields });
          setStatus("Thank you. Your quote request has been sent.");
          setFields((f) => ({ ...f, subject: "", message: "" }));
        } catch {
          setStatus("Your request could not be sent. Please try again or call +251 911 75 22 98.");
        } finally {
          setPending(false);
        }
      }}
    >
      <h2>Request a free quote</h2>
      {(
        [
          ["name", "Your name (required)"],
          ["email", "Email (required)"],
          ["subject", "Subject"],
          ["message", "How may we help you?"],
        ] as const
      ).map(([key, label]) => (
        <div className="quote-field" key={key}>
          <Label htmlFor={`home-${key}`}>
            {label} <span className="text-destructive">*</span>
          </Label>
          {key === "message" ? (
            <Textarea
              id={`home-${key}`}
              required
              rows={4}
              maxLength={2000}
              value={fields[key]}
              onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
            />
          ) : (
            <Input
              id={`home-${key}`}
              required
              type={key === "email" ? "email" : "text"}
              maxLength={key === "email" ? 255 : key === "name" ? 100 : 150}
              value={fields[key]}
              onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
            />
          )}
        </div>
      ))}
      <Button type="submit" disabled={pending} className="reference-button">
        {pending ? "Sending…" : "Get a quote"}
      </Button>
      {status && (
        <p className="quote-status" role="status">
          {status}
        </p>
      )}
    </form>
  );
}
