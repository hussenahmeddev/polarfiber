import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/lib/store";
import { useServerFn } from "@tanstack/react-start";
import { login as loginFn, register as registerFn } from "@/lib/api.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Polar Fiber" },
      { name: "description", content: "Sign in or create a Polar Fiber customer account." },
      { property: "og:title", content: "Sign in — Polar Fiber" },
      { property: "og:description", content: "Access your orders and quote history." },
    ],
  }),
  component: Login,
});

function Login() {
  const { refreshUser } = useStore();
  const login = useServerFn(loginFn);
  const register = useServerFn(registerFn);
  const nav = useNavigate();
  const [li, setLi] = useState({ email: "", password: "" });
  const [rg, setRg] = useState({ name: "", email: "", phone: "", password: "" });

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-3xl font-bold">Welcome to Polar Fiber</h1>
      <Tabs defaultValue="login" className="mt-8">
        <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="login">Sign in</TabsTrigger><TabsTrigger value="register">Create account</TabsTrigger></TabsList>
        <TabsContent value="login">
          <form className="space-y-4 rounded-xl border bg-card p-6" onSubmit={async (e) => {
            e.preventDefault();
            const r = await login({ data: li }).catch(() => ({ error: "Wrong email or password." }));
            if ("error" in r || !r.user) { toast.error(("error" in r && r.error) || "Sign in failed."); return; }
            const u = r.user; await refreshUser();
            toast.success(`Welcome back, ${u.name}`); nav({ to: u.role === "admin" ? "/admin" : "/account" });
          }}>
            <div><Label>Email</Label><Input type="email" value={li.email} onChange={(e) => setLi({ ...li, email: e.target.value })} /></div>
            <div><Label>Password</Label><Input type="password" value={li.password} onChange={(e) => setLi({ ...li, password: e.target.value })} /></div>
            <Button type="submit" className="w-full">Sign in</Button>
          </form>
        </TabsContent>
        <TabsContent value="register">
          <form className="space-y-4 rounded-xl border bg-card p-6" onSubmit={async (e) => {
            e.preventDefault();
            if (!rg.name.trim() || !/^\S+@\S+\.\S+$/.test(rg.email) || rg.password.length < 6) { toast.error("Enter your name, a valid email and a password of 6+ characters."); return; }
            const r = await register({ data: rg }).catch(() => ({ error: "Could not create account." }));
            if ("error" in r) { toast.error(r.error); return; }
            await refreshUser();
            toast.success("Account created"); nav({ to: "/account" });
          }}>
            <div><Label>Full name</Label><Input value={rg.name} onChange={(e) => setRg({ ...rg, name: e.target.value })} maxLength={100} /></div>
            <div><Label>Email</Label><Input type="email" value={rg.email} onChange={(e) => setRg({ ...rg, email: e.target.value })} maxLength={255} /></div>
            <div><Label>Phone</Label><Input value={rg.phone} onChange={(e) => setRg({ ...rg, phone: e.target.value })} maxLength={20} placeholder="+251..." /></div>
            <div><Label>Password</Label><Input type="password" value={rg.password} onChange={(e) => setRg({ ...rg, password: e.target.value })} /></div>
            <Button type="submit" className="w-full">Create account</Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
