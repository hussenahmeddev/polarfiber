import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Package, ShoppingBag, MessageSquare, Users, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { CATEGORIES, ORDER_STATUSES, QUOTE_STATUSES, etb, type Category, type Product } from "@/lib/data";
import { useStore, productsKey } from "@/lib/store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminData, saveProduct, deleteProduct, setOrderStatus, setQuoteStatus } from "@/lib/api.functions";
import type { OrderStatus, QuoteStatus } from "@/lib/data";

function useAdmin(enabled: boolean) {
  const qc = useQueryClient();
  const fetchData = useServerFn(getAdminData);
  const q = useQuery({ queryKey: ["admin"], queryFn: () => fetchData(), enabled });
  const save = useServerFn(saveProduct), del = useServerFn(deleteProduct), os = useServerFn(setOrderStatus), qs = useServerFn(setQuoteStatus);
  const run = async (fn: () => Promise<unknown>) => {
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong."); }
    await qc.invalidateQueries({ queryKey: ["admin"] }); await qc.invalidateQueries({ queryKey: productsKey });
  };
  return {
    loading: q.isLoading,
    orders: q.data?.orders ?? [], quotes: q.data?.quotes ?? [], products: q.data?.products ?? [], users: q.data?.users ?? [],
    saveProduct: (p: Product) => run(() => save({ data: p })),
    deleteProduct: (id: number) => run(() => del({ data: { id } })),
    setOrderStatus: (id: number, status: OrderStatus) => run(() => os({ data: { id, status } })),
    setQuoteStatus: (id: number, status: QuoteStatus) => run(() => qs({ data: { id, status } })),
  };
}

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Polar Fiber" },
      { name: "description", content: "Manage products, orders, quotes and customers." },
      { property: "og:title", content: "Admin Dashboard — Polar Fiber" },
      { property: "og:description", content: "Polar Fiber management dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

const empty: Product = { product_id: 0, name: "", category: "Water Tankers", capacity: "", price: 0, stock: 0, image: "", description: "" };
const sel = "h-9 rounded-md border bg-background px-2 text-sm";

function Admin() {
  const { user } = useStore();
  const s = useAdmin(user?.role === "admin");
  const [edit, setEdit] = useState<Product | null>(null);
  if (user?.role !== "admin") return <div className="mx-auto max-w-md px-4 py-20 text-center"><p>Admins only. Please sign in with an admin account.</p><Button asChild className="mt-4"><Link to="/login">Sign in</Link></Button></div>;

  const revenue = s.orders.filter((o) => o.status !== "Cancelled").reduce((t, o) => t + o.total, 0);
  const stats = [
    { icon: Package, label: "Products", value: s.products.length },
    { icon: ShoppingBag, label: "Orders", value: s.orders.length },
    { icon: MessageSquare, label: "Open quotes", value: s.quotes.filter((q) => q.status === "New").length },
    { icon: Users, label: "Customers", value: s.users.filter((u) => u.role === "customer").length },
  ];
  const userName = (id: number | null) => s.users.find((u) => u.user_id === id)?.name ?? "Guest";

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl font-bold">Admin dashboard</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-5">
        {stats.map((x) => (
          <div key={x.label} className="rounded-xl border bg-card p-4"><x.icon className="h-5 w-5 text-primary" /><p className="mt-2 font-display text-2xl font-bold">{x.value}</p><p className="text-sm text-muted-foreground">{x.label}</p></div>
        ))}
        <div className="rounded-xl bg-water p-4 text-deep-foreground"><p className="text-sm opacity-80">Order value</p><p className="mt-2 font-display text-xl font-bold">{etb(revenue)}</p></div>
      </div>

      <Tabs defaultValue="orders" className="mt-10">
        <TabsList><TabsTrigger value="orders">Orders</TabsTrigger><TabsTrigger value="quotes">Quotes</TabsTrigger><TabsTrigger value="products">Products</TabsTrigger><TabsTrigger value="users">Users</TabsTrigger></TabsList>

        <TabsContent value="orders" className="mt-4 overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left"><tr><th className="p-3">#</th><th>Customer</th><th>Date</th><th>Address</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>{s.orders.map((o) => (
              <tr key={o.order_id} className="border-t"><td className="p-3 font-semibold">{o.order_id}</td><td>{userName(o.user_id)}</td><td>{o.created_at}</td><td>{o.address}</td><td>{etb(o.total)}</td>
                <td><select className={sel} value={o.status} onChange={(e) => s.setOrderStatus(o.order_id, e.target.value as never)}>{ORDER_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></td></tr>
            ))}</tbody>
          </table>
        </TabsContent>

        <TabsContent value="quotes" className="mt-4 space-y-3">
          {s.quotes.map((q) => (
            <div key={q.quote_id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{q.subject}</p>
                <div className="flex items-center gap-2"><StatusBadge s={q.status} /><select className={sel} value={q.status} onChange={(e) => s.setQuoteStatus(q.quote_id, e.target.value as never)}>{QUOTE_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></div></div>
              <p className="text-sm text-muted-foreground">{q.name} · <a className="text-primary" href={`mailto:${q.email}`}>{q.email}</a> · {q.created_at}</p>
              <p className="mt-2 text-sm">{q.message}</p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <Button onClick={() => setEdit(empty)}><Plus className="h-4 w-4" />Add product</Button>
          <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left"><tr><th className="p-3">Product</th><th>Category</th><th>Price</th><th>Stock</th><th /></tr></thead>
              <tbody>{s.products.map((p) => (
                <tr key={p.product_id} className="border-t"><td className="p-3 font-semibold">{p.name}</td><td>{p.category}</td><td>{etb(p.price)}</td><td>{p.stock}</td>
                  <td className="space-x-1 pr-3 text-right"><Button size="icon" variant="ghost" onClick={() => setEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete ${p.name}?`)) s.deleteProduct(p.product_id); }}><Trash2 className="h-4 w-4" /></Button></td></tr>
              ))}</tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-4 overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left"><tr><th className="p-3">Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Orders</th></tr></thead>
            <tbody>{s.users.map((u) => (
              <tr key={u.user_id} className="border-t"><td className="p-3 font-semibold">{u.name}</td><td>{u.email}</td><td>{u.phone}</td><td className="capitalize">{u.role}</td><td>{s.orders.filter((o) => o.user_id === u.user_id).length}</td></tr>
            ))}</tbody>
          </table>
        </TabsContent>
      </Tabs>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.product_id ? "Edit product" : "Add product"}</DialogTitle></DialogHeader>
          {edit && (
            <form className="space-y-3" onSubmit={(e) => {
              e.preventDefault();
              if (!edit.name.trim() || edit.price <= 0) { toast.error("Name and a price above 0 are required."); return; }
              void s.saveProduct(edit).then(() => toast.success("Product saved")); setEdit(null);
            }}>
              <div><Label>Name</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label><select className={`${sel} w-full`} value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as Category })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
                <div><Label>Capacity</Label><Input value={edit.capacity ?? ""} onChange={(e) => setEdit({ ...edit, capacity: e.target.value })} /></div>
                <div><Label>Price (ETB)</Label><Input type="number" value={edit.price} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })} /></div>
                <div><Label>Stock</Label><Input type="number" value={edit.stock} onChange={(e) => setEdit({ ...edit, stock: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Image link</Label><Input value={edit.image} onChange={(e) => setEdit({ ...edit, image: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <Button type="submit" className="w-full">Save</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
