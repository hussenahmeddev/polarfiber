import * as React from "react";
import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ProtectedRoute } from "@/frontend/components/ProtectedRoute";
import { useStore } from "@/frontend/store";
import { cn } from "@/frontend/utils";
import {
  LayoutDashboard,
  Package,
  FileText,
  MessageSquare,
  Heart,
  User as UserIcon,
  MapPin,
  Bell,
  Globe,
  LogOut,
  ShoppingBag,
  Menu,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/frontend/components/ThemeToggle";
import {
  getMyOrders,
  getMyQuotes,
  getMyNotifications,
  getCustomerConversations,
} from "@/backend/api.functions";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Customer Dashboard — Polar Fiber" },
      {
        name: "description",
        content: "Manage your Polar Fiber orders, quote requests, and account settings.",
      },
      { property: "og:title", content: "Customer Dashboard — Polar Fiber" },
      { property: "og:description", content: "Track your orders, quotes, and profile." },
    ],
  }),
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <ProtectedRoute roles={["customer", "admin", "staff"]}>
      <DashboardShell />
    </ProtectedRoute>
  );
}

function DashboardShell() {
  const { user, logout } = useStore();
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Server functions for badge counts
  const fetchOrders = useServerFn(getMyOrders);
  const fetchQuotes = useServerFn(getMyQuotes);
  const fetchNotifications = useServerFn(getMyNotifications);
  const fetchConversations = useServerFn(getCustomerConversations);

  const ordersQuery = useQuery({
    queryKey: ["customer", "orders", user?.user_id],
    queryFn: () => fetchOrders(),
    enabled: !!user,
  });

  const quotesQuery = useQuery({
    queryKey: ["customer", "quotes", user?.user_id],
    queryFn: () => fetchQuotes(),
    enabled: !!user,
  });

  const notificationsQuery = useQuery({
    queryKey: ["customer", "notifications", user?.user_id],
    queryFn: () => fetchNotifications(),
    enabled: !!user,
  });

  const conversationsQuery = useQuery({
    queryKey: ["customer", "conversations", user?.user_id],
    queryFn: () => fetchConversations(),
    enabled: !!user,
  });

  const allOrders = ordersQuery.data ?? [];
  const allQuotes = quotesQuery.data ?? [];
  const unreadRepliesCount = (conversationsQuery.data ?? []).filter(
    (c) => c.status === "Admin Replied",
  ).length;

  // Compute unread notifications count
  const dbUnreadCount = (notificationsQuery.data ?? []).filter((n) => !n.is_read).length;
  // We always have 1 seed unread notification
  const unreadNotificationsCount = dbUnreadCount > 0 ? dbUnreadCount : 1;

  const handleSignOut = async () => {
    await logout();
    nav({ to: "/", replace: true });
  };

  // Navigation items with route paths
  const navItems = [
    { path: "/dashboard", label: "Overview", icon: LayoutDashboard },
    {
      path: "/dashboard/orders",
      label: "My Orders",
      icon: Package,
      badge: allOrders.length || undefined,
    },
    {
      path: "/dashboard/quotes",
      label: "My Quotes",
      icon: FileText,
      badge: allQuotes.length || undefined,
    },
    {
      path: "/dashboard/messages",
      label: "Messages",
      icon: MessageSquare,
      badge: unreadRepliesCount || undefined,
    },
    { path: "/dashboard/favorites", label: "Favorites", icon: Heart },
    { path: "/dashboard/profile", label: "Profile", icon: UserIcon },
    { path: "/dashboard/addresses", label: "Addresses", icon: MapPin },
    {
      path: "/dashboard/notifications",
      label: "Notifications",
      icon: Bell,
      badge: unreadNotificationsCount || undefined,
    },
    { path: "/dashboard/support", label: "Support", icon: Globe },
  ];

  // Determine which nav item is active based on current pathname
  const getIsActive = (itemPath: string) => {
    // Exact match for overview (index route)
    if (itemPath === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/dashboard/";
    }
    return pathname.startsWith(itemPath);
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
          <UserIcon className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-foreground">Please Sign In</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to access your customer dashboard, track orders, and view quote inquiries.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Sign In to Polar Fiber
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground antialiased flex flex-col">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/images/logo.png" alt="Polar Fiber" className="h-8 w-auto object-contain" />
            <span className="font-bold text-base text-foreground tracking-tight">Polar Fiber</span>
          </Link>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <ThemeToggle />
          <span className="text-sm font-medium text-muted-foreground hidden sm:inline-block">
            {user.name}
          </span>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1">
        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-xs lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar Navigation */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar p-4 pt-6 transition-transform duration-200 lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)] lg:translate-x-0 lg:overflow-y-auto",
            mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0",
          )}
        >
          <div className="space-y-4">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = getIsActive(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
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
                    {item.badge !== undefined && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-bold",
                          isActive
                            ? "bg-sidebar-accent/60 text-sidebar-accent-foreground"
                            : "bg-sidebar-border text-sidebar-foreground/70",
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="pt-4 border-t border-sidebar-border space-y-2">
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 rounded-lg transition-colors"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Back to Store</span>
            </Link>
          </div>
        </aside>

        {/* Main Content Area - Outlet renders child routes */}
        <main className="flex-1 min-w-0 p-6 sm:p-8 lg:p-10">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
