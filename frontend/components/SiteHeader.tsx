import { Link } from "@tanstack/react-router";
import { ShoppingCart, User } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { useStore } from "@/frontend/store";

const nav = [
  { to: "/", label: "Home" },
  { to: "/products", label: "Products" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
  { to: "/quote", label: "Get a Quote" },
] as const;

export function SiteHeader() {
  const { user, cart } = useStore();
  const count = cart.reduce((t, c) => t + c.quantity, 0);
  const items = [
    ...nav,
    ...(user?.role === "admin" ? [{ to: "/admin" as const, label: "Admin" }] : []),
  ];

  return (
    <header className="reference-header sticky top-0 z-40 border-b">
      <div className="reference-header-inner">
        <Link
          to="/"
          className="shrink-0"
          aria-label="Polar Fiber home"
        >
          <img src="/images/logo.png" className="reference-logo" alt="Polar Fiber" width={112} height={48} />
        </Link>
        <nav className="reference-nav" aria-label="Main navigation">
          {items.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="whitespace-nowrap py-2 font-medium text-foreground"
              activeProps={{ className: "text-primary" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <Button asChild className="reference-button hidden lg:inline-flex"><Link to="/contact">Contact</Link></Button>
          <Link to="/cart" className="relative rounded-md p-2 hover:bg-muted" aria-label="Cart">
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-xs font-bold text-accent-foreground">
                {count}
              </span>
            )}
          </Link>
          <Link
            to={user ? "/account" : "/login"}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{user ? user.name.split(" ")[0] : "Sign in"}</span>
          </Link>
        </div>

      </div>
      <nav aria-label="Mobile navigation" className="flex gap-1 overflow-x-auto border-t px-4 py-3 md:hidden">
        {items.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="whitespace-nowrap px-2 text-sm text-muted-foreground"
            activeProps={{ className: "text-primary font-semibold" }}
            activeOptions={{ exact: n.to === "/" }}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="reference-footer border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3">
        <div>
          <img src="/images/logo.png" alt="Polar Fiber" className="reference-logo" width={112} height={48} />
          <p className="mt-2 text-sm opacity-75">
            Where Quality Meets Every Drop. Food-grade water tankers with a 10-year warranty.
          </p>
        </div>
        <div className="text-sm opacity-85">
          <p className="font-semibold">Visit us</p>
          <p className="mt-2">Jemoo Furi 2, Addis Ababa, Ethiopia</p>
        </div>
        <div className="text-sm opacity-85">
          <p className="font-semibold">Call us</p>
          <a href="tel:+251911752298" className="mt-2 block">
            +251 911 75 22 98
          </a>
        </div>
      </div>
    </footer>
  );
}
