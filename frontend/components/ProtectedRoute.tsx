import * as React from "react";
import { Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useStore } from "@/frontend/store";
import type { Role } from "@/shared/data";
import { NotAuthorized } from "@/frontend/components/NotAuthorized";
import { MustChangePasswordModal } from "@/frontend/components/MustChangePasswordModal";
import { usePermissions } from "@/frontend/hooks/usePermissions";

interface ProtectedRouteProps {
  roles?: Role[];
  permission?: string;
  redirectTo?: string;
  children?: React.ReactNode;
}

/**
 * Wraps content that requires authentication and (optionally) specific roles or permissions.
 *
 * - `undefined` user            → still loading   → centered spinner
 * - `null` user                 → not logged in   → redirects to `redirectTo` (/login)
 * - `must_change_password`      → force password change dialog before accessing content
 * - unauthorized role           → renders <NotAuthorized />
 * - missing permission          → renders <NotAuthorized />
 */
export function ProtectedRoute({
  roles,
  permission,
  redirectTo = "/login",
  children,
}: ProtectedRouteProps) {
  const { user, refreshUser } = useStore();
  const { hasPermission } = usePermissions();

  // Still loading — show spinner
  if (user === undefined) {
    return (
      <div className="grid h-screen place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not authenticated — redirect to login
  if (!user) {
    return <Navigate to={redirectTo} />;
  }

  // First-login mandatory password change
  if (user.must_change_password) {
    return <MustChangePasswordModal user={user} onComplete={() => refreshUser()} />;
  }

  // Authenticated but wrong role
  if (roles && !roles.includes(user.role)) {
    return <NotAuthorized userRole={user.role} />;
  }

  // Authenticated but missing required permission
  if (permission && !hasPermission(permission)) {
    return (
      <NotAuthorized
        userRole={user.role}
        message={`You do not have the required permission (${permission}) to view this resource.`}
      />
    );
  }

  return <>{children}</>;
}
