import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, ShieldCheck, Truck, Droplets } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { login as loginFn, register as registerFn } from "@/backend/api.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Sign in — Polar Fiber" },
      { name: "description", content: "Sign in or create a Polar Fiber customer account." },
      { property: "og:title", content: "Sign in — Polar Fiber" },
      { property: "og:description", content: "Access your orders and quote history." },
    ],
  }),
  component: Login,
});

const emailOk = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());

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

function Login() {
  const qc = useQueryClient();
  const login = useServerFn(loginFn);
  const register = useServerFn(registerFn);
  const nav = useNavigate();
  const [li, setLi] = useState({ email: "", password: "" });
  const [rg, setRg] = useState({ name: "", email: "", phone: "", password: "" });
  const [liErr, setLiErr] = useState<Record<string, string>>({});
  const [rgErr, setRgErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const errs: Record<string, string> = {};
    if (!emailOk(li.email)) errs["email"] = "Enter a valid email address.";
    if (!li.password) errs["password"] = "Enter your password.";
    setLiErr(errs);
    setFormError("");
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const r = await login({ data: li }).catch((err) => {
        console.error("Login request error:", err);
        return {
          error: "We couldn't reach the server. Please try again in a moment.",
        };
      });
      if ("error" in r || !r.user) {
        setFormError(("error" in r && r.error) || "Sign in failed. Please try again.");
        return;
      }
      // Seed the store cache directly with the returned user so the
      // ProtectedRoute on the next page sees the user immediately —
      // no background re-fetch race needed.
      qc.setQueryData(["me"], r.user);
      toast.success(`Welcome back, ${r.user.name}`);
      nav({ to: r.user.role === "admin" || r.user.role === "staff" ? "/admin" : "/dashboard" });
    } finally {
      setBusy(false);
    }
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const errs: Record<string, string> = {};
    if (!rg.name.trim()) errs["name"] = "Enter your full name.";
    if (!emailOk(rg.email)) errs["email"] = "Enter a valid email address.";
    if (rg.password.length < 6) errs["password"] = "Use at least 6 characters.";
    setRgErr(errs);
    setFormError("");
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const r = await register({ data: rg }).catch(() => ({
        error: "We couldn't create your account right now. Please try again.",
      }));
      if ("error" in r || !r.user) {
        setFormError(("error" in r && r.error) || "Could not create account.");
        return;
      }
      // Seed the store cache directly so the redirect lands with user already set.
      qc.setQueryData(["me"], r.user);
      toast.success("Account created");
      nav({ to: "/dashboard" });
    } finally {
      setBusy(false);
    }
  }

  const submit = (label: string) => (
    <Button type="submit" className="w-full" disabled={busy}>
      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {busy ? "Please wait..." : label}
    </Button>
  );

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-2 lg:items-center lg:py-20">
      <section className="hidden rounded-2xl bg-primary p-10 text-primary-foreground lg:block">
        <img src="/images/logo.png" alt="" className="h-12 w-auto rounded bg-background p-1" />
        <h2 className="mt-8 text-3xl font-bold leading-tight">Your Polar Fiber account</h2>
        <p className="mt-3 opacity-90">Track your orders and quote requests in one place.</p>
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

      <div className="mx-auto w-full max-w-md">
        <h1 className="text-center text-3xl font-bold">Welcome to Polar Fiber</h1>
        <Tabs defaultValue="login" className="mt-8" onValueChange={() => setFormError("")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Sign in</TabsTrigger>
            <TabsTrigger value="register">Create account</TabsTrigger>
          </TabsList>
          {formError && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {formError}
            </div>
          )}
          <TabsContent value="login">
            <form
              noValidate
              className="space-y-4 rounded-xl border bg-card p-6 shadow-sm"
              onSubmit={onLogin}
            >
              <Field id="li-email" label="Email" error={liErr["email"]}>
                <Input
                  id="li-email"
                  type="email"
                  autoFocus
                  autoComplete="email"
                  value={li.email}
                  aria-invalid={!!liErr["email"] || undefined}
                  onChange={(e) => setLi({ ...li, email: e.target.value })}
                />
              </Field>
              <Field id="li-pass" label="Password" error={liErr["password"]}>
                <PasswordInput
                  id="li-pass"
                  autoComplete="current-password"
                  value={li.password}
                  invalid={!!liErr["password"]}
                  onChange={(v) => setLi({ ...li, password: v })}
                />
              </Field>
              <div className="flex justify-end -mt-1">
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              {submit("Sign in")}
            </form>
          </TabsContent>
          <TabsContent value="register">
            <form
              noValidate
              className="space-y-4 rounded-xl border bg-card p-6 shadow-sm"
              onSubmit={onRegister}
            >
              <Field id="rg-name" label="Full name" error={rgErr["name"]}>
                <Input
                  id="rg-name"
                  autoComplete="name"
                  value={rg.name}
                  maxLength={100}
                  onChange={(e) => setRg({ ...rg, name: e.target.value })}
                />
              </Field>
              <Field id="rg-email" label="Email" error={rgErr["email"]}>
                <Input
                  id="rg-email"
                  type="email"
                  autoComplete="email"
                  value={rg.email}
                  maxLength={255}
                  onChange={(e) => setRg({ ...rg, email: e.target.value })}
                />
              </Field>
              <Field id="rg-phone" label="Phone">
                <Input
                  id="rg-phone"
                  type="tel"
                  autoComplete="tel"
                  value={rg.phone}
                  maxLength={20}
                  placeholder="+251..."
                  onChange={(e) => setRg({ ...rg, phone: e.target.value })}
                />
              </Field>
              <Field id="rg-pass" label="Password" error={rgErr["password"]}>
                <PasswordInput
                  id="rg-pass"
                  autoComplete="new-password"
                  value={rg.password}
                  invalid={!!rgErr["password"]}
                  onChange={(v) => setRg({ ...rg, password: v })}
                />
              </Field>
              {submit("Create account")}
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
