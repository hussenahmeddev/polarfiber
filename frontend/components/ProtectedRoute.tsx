import * as React from "react";
import { Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useStore } from "@/frontend/store";
import type { Role } from "@/shared/data";

interface ProtectedRouteProps {
  roles: Role[];
  redirectTo?: string;
  children?: React.ReactNode;
}

/**
 * Wraps content that requires authentication and (optionally) specific roles.
 *
 * - `undefined` user  → still loading  → shows a centered spinner
 * - `null` user       → not logged in  → redirects to `redirectTo` (default /login)
 * - wrong role        → redirects by role: admin/staff → /admin, customer → /account
 */
export function ProtectedRoute({
  roles,
  redirectTo = "/login",
  children,
}: ProtectedRouteProps) {
  const { user } = useStore();

  // Still loading — show spinner
  if (user === undefined) {
    return (
      <div className="grid h-screen place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not authenticated — redirect to login (or provided path)
  if (!user) {
    return <Navigate to={redirectTo} />;
  }

  // Authenticated but wrong role
  if (!roles.includes(user.role)) {
    const fallback =
      user.role === "admin" || user.role === "staff" ? "/admin" : "/account";
    return <Navigate to={fallback} />;
  }

  return <>{children}</>;
}
