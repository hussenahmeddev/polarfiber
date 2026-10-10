import * as React from "react";
import { usePermissions } from "@/frontend/hooks/usePermissions";

export interface CanProps {
  permission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Conditionally renders children if the authenticated user has the specified permission.
 * Uses the permissions retrieved from GET /api/auth/permissions.
 */
export function Can({ permission, fallback = null, children }: CanProps) {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
