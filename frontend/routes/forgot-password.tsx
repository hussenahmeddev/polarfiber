import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Droplets, ShieldCheck, Truck, ArrowLeft } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { forgotPassword as forgotPasswordFn } from "@/backend/api.functions";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot Password — Polar Fiber" },
      { name: "description", content: "Reset your Polar Fiber account password." },
      { property: "og:title", content: "Forgot Password — Polar Fiber" },
    ],
  }),
  component: ForgotPassword,
});

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ForgotPassword() {
  const forgotPassword = useServerFn(forgotPasswordFn);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFieldError("");

    const trimmed = email.trim();
    if (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed)) {
      setFieldError("Enter a valid email address.");
      return;
    }

    setBusy(true);
    try {
      await forgotPassword({ data: { email: trimmed } }).catch(() => null);
      // Always show success — never reveal whether the email exists
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-2 lg:items-center lg:py-20">
      {/* Brand panel */}
      <section className="hidden rounded-2xl bg-primary p-10 text-primary-foreground lg:block">
        <img src="/images/logo.png" alt="" className="h-12 w-auto rounded bg-background p-1" />
        <h2 className="mt-8 text-3xl font-bold leading-tight">Reset your password</h2>
        <p className="mt-3 opacity-90">We'll send a secure reset link to your email address.</p>
        <ul className="mt-8 space-y-4 text-sm">
          <li className="flex gap-3">
            <Droplets className="h-5 w-5 shrink-0" /> Food-grade water tankers
          </li>
          <li className="flex gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0" /> 10-year tanker warranty
          </li>
          <li className="flex gap-3">
            <Truck className="h-5 w-5 shrink-0" /> Order status from pending to delivered
          </li>
        </ul>
      </section>

      {/* Form panel */}
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-center text-3xl font-bold text-foreground">Forgot password?</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Enter your account email and we'll send you a reset link.
        </p>

        <div className="mt-8">
          {sent ? (
            <div className="rounded-xl border border-border bg-card p-8 shadow-sm text-center space-y-4">
              <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-primary/10">
                <ShieldCheck className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Check your inbox</h2>
              <p className="text-sm text-muted-foreground">
                If an account exists for that email, a reset link has been sent. It expires in 30
                minutes.
              </p>
              <Button asChild variant="outline" className="w-full gap-2">
                <Link to="/login">
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </Link>
              </Button>
            </div>
          ) : (
            <form
              noValidate
              className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm"
              onSubmit={onSubmit}
            >
              <Field id="fp-email" label="Email address" error={fieldError}>
                <Input
                  id="fp-email"
                  type="email"
                  autoFocus
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  aria-invalid={!!fieldError || undefined}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>

              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {busy ? "Sending…" : "Send reset link"}
              </Button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
