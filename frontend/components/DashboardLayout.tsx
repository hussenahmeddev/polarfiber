import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useStore } from "@/frontend/store";
import { Button } from "@/frontend/components/ui/button";
import {
  Sun,
  Moon,
  LogOut,
  ShieldAlert,
  User as UserIcon,
  ChevronRight,
  ArrowLeft,
  Store,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/frontend/utils";

export interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number | undefined;
}

interface DashboardLayoutProps {
  title: string;
  subtitle?: string | undefined;
  items: NavItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children: React.ReactNode;
  headerAction?: React.ReactNode | undefined;
  isAdmin?: boolean | undefined;
}

export function DashboardLayout({
  title,
  subtitle,
  items,
  activeTab,
  onTabChange,
  children,
  headerAction,
  isAdmin = false,
}: DashboardLayoutProps) {
  const { user, logout } = useStore();
  const nav = useNavigate();
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    const html = document.documentElement;
    if (html.classList.contains("dark")) {
      html.classList.remove("dark");
      setIsDark(false);
      localStorage.setItem("polarfiber-theme", "light");
    } else {
      html.classList.add("dark");
      setIsDark(true);
      localStorage.setItem("polarfiber-theme", "dark");
    }
  };

  const handleSignOut = async () => {
    await logout();
    nav({ to: "/", replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile Top Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/90 px-4 py-3 backdrop-blur-md lg:hidden">
        <Link to="/" className="flex items-center gap-2">
          <img src="/images/logo.png" alt="Polar Fiber" className="h-8 w-auto object-contain" />
          <span className="font-display font-bold text-sm tracking-tight text-foreground">Polar Fiber</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs">
            <Link to="/">
              <Store className="h-3.5 w-3.5" />
              Store
            </Link>
          </Button>
          <button
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground"
            aria-label="Toggle theme"
          >
            {isDark ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-amber-500" />}
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex w-full flex-col lg:flex-row min-h-screen">
        {/* Desktop Sidebar docked to the left */}
        <aside className="hidden w-72 shrink-0 flex-col justify-between border-r border-border bg-card/60 p-6 lg:flex lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
          <div className="space-y-6">
            {/* Brand Logo & Back to Store button */}
            <div className="space-y-3 border-b border-border pb-5">
              <Link to="/" className="flex items-center gap-3">
                <img src="/images/logo.png" alt="Polar Fiber" className="h-10 w-auto object-contain" />
                <div>
                  <p className="font-display font-bold text-base leading-none text-foreground">Polar Fiber</p>
                  <p className="mt-1 text-[11px] font-semibold text-primary uppercase tracking-wider">
                    {isAdmin ? "Admin Console" : "Customer Portal"}
                  </p>
                </div>
              </Link>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                <Link to="/">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Storefront
                </Link>
              </Button>
            </div>

            {/* User Profile Capsule */}
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3 shadow-2xs">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                {user?.name?.charAt(0).toUpperCase() ?? "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold leading-tight text-foreground">
                  {user?.name ?? "User"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={cn(
                      "group flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 cursor-pointer",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform group-hover:scale-110",
                          isActive ? "text-primary-foreground" : "text-muted-foreground",
                        )}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          isActive
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer Controls */}
          <div className="mt-8 space-y-2 border-t border-border pt-4">
            {/* Switch to customer/admin shortcut if user is admin or staff */}
            {(user?.role === "admin" || user?.role === "staff") && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <Link to={isAdmin ? "/account" : "/admin"}>
                  {isAdmin ? (
                    <>
                      <UserIcon className="h-4 w-4" />
                      Switch to Customer Portal
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-4 w-4 text-primary" />
                      Switch to Admin Panel
                    </>
                  )}
                </Link>
              </Button>
            )}

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground cursor-pointer"
            >
              <span className="flex items-center gap-2">
                {isDark ? <Moon className="h-3.5 w-3.5 text-primary" /> : <Sun className="h-3.5 w-3.5 text-amber-500" />}
                Theme: {isDark ? "Dark mode" : "Light mode"}
              </span>
              <span className="text-[11px] text-muted-foreground">Toggle</span>
            </button>

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 pb-24 pt-6 px-4 sm:px-8 lg:px-12">
          {/* Header Banner */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{isAdmin ? "Admin Portal" : "Customer Portal"}</span>
                <ChevronRight className="h-3 w-3" />
                <span className="font-semibold text-foreground capitalize">
                  {items.find((i) => i.id === activeTab)?.label ?? activeTab}
                </span>
              </div>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
                {title}
              </h1>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>

            {headerAction && <div className="flex items-center gap-3">{headerAction}</div>}
          </div>

          {/* Subview Content */}
          <div className="animate-in fade-in-50 duration-200">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-around px-2 py-2">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "relative flex flex-col items-center gap-1 rounded-lg px-3 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                  isActive
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="absolute -right-1 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
