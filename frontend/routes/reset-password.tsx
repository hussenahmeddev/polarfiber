import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Eye, EyeOff, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { toast } from "sonner";
import { resetPassword as resetPasswordFn } from "@/backend/api.functions";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s["token"] === "string" ? s["token"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Reset Password — Polar Fiber" },
      { name: "description", content: "Set a new password for your Polar Fiber account." },
      { property: "og:title", content: "Reset Password — Polar Fiber" },
    ],
  }),
  component: ResetPassword,
});

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
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

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  invalid?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function ResetPassword() {
  const { token } = Route.useSearch();
  const resetPassword = useServerFn(resetPasswordFn);
  const nav = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  // No token in URL
  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center space-y-4">
        <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Invalid reset link</h1>
        <p className="text-sm text-muted-foreground">
          This password reset link is missing or invalid. Please request a new one.
        </p>
        <Button asChild className="w-full">
          <Link to="/forgot-password">Request new link</Link>
        </Button>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const errs: Record<string, string> = {};
    if (password.length < 6) errs["password"] = "Use at least 6 characters.";
    if (password !== confirm) errs["confirm"] = "Passwords do not match.";
    setErrors(errs);
    setFormError("");
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const r = await resetPassword({ data: { token, password } }).catch(() => ({
        error: "We couldn't reach the server. Please try again.",
      }));
      if ("error" in r && r.error) {
        setFormError(r.error);
        return;
      }
      toast.success("Password updated! Please sign in with your new password.");
      nav({ to: "/login" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-2 lg:items-center lg:py-20">
      {/* Brand panel */}
      <section className="hidden rounded-2xl bg-primary p-10 text-primary-foreground lg:block">
        <img src="/images/logo.png" alt="" className="h-12 w-auto rounded bg-background p-1" />
        <h2 className="mt-8 text-3xl font-bold leading-tight">Set a new password</h2>
        <p className="mt-3 opacity-90">
          Choose a strong password of at least 6 characters.
        </p>
        <div className="mt-8 flex items-center gap-3 rounded-xl bg-primary-foreground/10 p-4 text-sm">
          <ShieldCheck className="h-5 w-5 shrink-0 opacity-80" />
          <span>Your reset link expires 30 minutes after it was sent.</span>
        </div>
      </section>

      {/* Form panel */}
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-center text-3xl font-bold text-foreground">Set new password</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Enter and confirm your new password below.
        </p>

        <div className="mt-8">
          {formError && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {formError}
            </div>
          )}

          <form
            noValidate
            className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm"
            onSubmit={onSubmit}
          >
            <Field id="rp-password" label="New password" error={errors["password"]}>
              <PasswordInput
                id="rp-password"
                autoComplete="new-password"
                value={password}
                invalid={!!errors["password"]}
                onChange={setPassword}
              />
            </Field>

            <Field id="rp-confirm" label="Confirm new password" error={errors["confirm"]}>
              <PasswordInput
                id="rp-confirm"
                autoComplete="new-password"
                value={confirm}
                invalid={!!errors["confirm"]}
                onChange={setConfirm}
              />
            </Field>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {busy ? "Updating…" : "Update password"}
            </Button>

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
