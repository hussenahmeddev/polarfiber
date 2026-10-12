import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  Layers,
  Boxes,
  ShoppingCart,
  FileText,
  Users,
  MessageSquare,
  HelpCircle,
  BarChart2,
  ScrollText,
  Settings,
  ArrowLeft,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useStore } from "@/frontend/store";
import { cn } from "@/frontend/utils";
import { usePermissions } from "@/frontend/hooks/usePermissions";
import { ThemeToggle } from "@/frontend/components/ThemeToggle";

export interface NavItemDef {
  id: string;
  label: string;
  icon: React.ElementType;
  permission?: string;
  badge?: string | number | undefined;
}

export const ADMIN_NAV_ITEMS: NavItemDef[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, permission: "dashboard.view" },
  { id: "products", label: "Products", icon: Package, permission: "products.view" },
  { id: "categories", label: "Categories", icon: Layers, permission: "categories.view" },
  { id: "inventory", label: "Inventory", icon: Boxes, permission: "inventory.view" },
  { id: "orders", label: "Orders", icon: ShoppingCart, permission: "orders.view" },
  { id: "quotes", label: "Quotes", icon: FileText, permission: "quotes.view" },
  { id: "customers", label: "Customers", icon: Users, permission: "customers.view" },
  { id: "messages", label: "Messages", icon: MessageSquare, permission: "messages.view" },
  { id: "support", label: "Support", icon: HelpCircle, permission: "support.view" },
  { id: "reports", label: "Reports", icon: BarChart2, permission: "reports.view" },
  { id: "audit-logs", label: "Audit Logs", icon: ScrollText, permission: "audit.view" },
  { id: "settings", label: "Settings", icon: Settings, permission: "profile.update" },
];

interface AdminSidebarLayoutProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: React.ReactNode;
  badges?: Record<string, string | number | undefined>;
}

export function AdminSidebarLayout({
  activeTab,
  onTabChange,
  children,
  badges = {},
}: AdminSidebarLayoutProps) {
  const { user, logout } = useStore();
  const { hasPermission } = usePermissions();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Dynamically filter sidebar items based on GET /api/auth/permissions
  const visibleNavItems = ADMIN_NAV_ITEMS.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(item.permission);
  });

  const handleSignOut = async () => {
    await logout();
    nav({ to: "/", replace: true });
  };

  const isStaff = user?.role === "staff";
  const consoleTitle = isStaff ? "Staff Console" : "Admin Console";

  return (
    <div className="flex min-h-screen bg-background text-foreground antialiased">
      {/* Mobile Top Header */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-sidebar-border bg-sidebar/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <img src="/images/logo.png" alt="Polar Fiber" className="h-7 w-auto object-contain" />
          <span className="font-bold text-sm text-sidebar-foreground">
            Polar Fiber {isStaff ? "Staff" : "Admin"}
          </span>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-sidebar-primary hover:text-sidebar-primary/80 bg-sidebar-primary/10 px-2.5 py-1 rounded-lg"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Store
        </Link>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar (Desktop sticky + Mobile slide-over) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar p-4 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:overflow-y-auto",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="space-y-4">
          {/* Logo Brand Header */}
          <div className="flex items-center justify-between px-2 pt-1 pb-2">
            <Link to="/" className="flex items-center gap-3">
              <img src="/images/logo.png" alt="Polar Fiber" className="h-9 w-auto object-contain" />
              <div>
                <p className="text-sm font-bold leading-tight text-sidebar-foreground">
                  Polar Fiber
                </p>
                <p className="text-[11px] font-semibold text-sidebar-primary tracking-wide uppercase">
                  {consoleTitle}
                </p>
              </div>
            </Link>
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1 text-sidebar-foreground/50 hover:text-sidebar-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Dynamic Navigation Items List based on permissions */}
          <nav className="space-y-0.5 pt-2">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const badge = badges[item.id] ?? item.badge;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    setMobileOpen(false);
                  }}
                  className={cn(
                    "group flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 cursor-pointer text-left",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-2xs"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform group-hover:scale-105",
                        isActive
                          ? "text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/40 group-hover:text-sidebar-accent-foreground",
                      )}
                    />
                    <span>{item.label}</span>
                  </div>
                  {badge !== undefined && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-bold",
                        isActive
                          ? "bg-sidebar-accent/60 text-sidebar-accent-foreground"
                          : "bg-sidebar-border text-sidebar-foreground/70",
                      )}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="space-y-3 border-t border-sidebar-border pt-3">
          {/* Back to Storefront Link & Theme Toggle */}
          <div className="flex items-center justify-between gap-2 px-1">
            <Link
              to="/"
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-sidebar-foreground/40" />
              <span>Storefront</span>
            </Link>
            <ThemeToggle className="h-8 w-8 rounded-lg border border-sidebar-border bg-sidebar-accent/30 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" />
          </div>

          {/* User Capsule with Role Badge */}
          <div className="flex items-center justify-between rounded-xl bg-sidebar-accent/30 p-2.5 border border-sidebar-border">
            <div className="flex items-center gap-2.5 min-w-0 pr-1">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold text-xs",
                  isStaff
                    ? "bg-amber-500 text-amber-950 font-extrabold"
                    : "bg-sidebar-primary text-sidebar-primary-foreground",
                )}
              >
                {user?.name?.charAt(0).toUpperCase() ?? "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-sidebar-foreground leading-tight">
                  {user?.name ?? "User"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                      user?.role === "admin"
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : user?.role === "staff"
                          ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {user?.role === "staff"
                      ? "Staff"
                      : user?.role === "admin"
                        ? "Admin"
                        : "Customer"}
                  </span>
                  <p className="truncate text-[10px] text-sidebar-foreground/60">{user?.email}</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="p-1.5 text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-auto p-6 sm:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
