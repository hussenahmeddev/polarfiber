import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUserPermissions } from "@/backend/api.functions";
import { useStore } from "@/frontend/store";
import { hasPermission as checkRolePermission } from "@/shared/permissions";

export function usePermissions() {
  const { user } = useStore();
  const fetchPermissions = useServerFn(getUserPermissions);

  const query = useQuery({
    queryKey: ["auth", "permissions", user?.user_id, user?.role],
    queryFn: async () => {
      // First try GET /api/auth/permissions directly
      try {
        const res = await fetch("/api/auth/permissions");
        if (res.ok) {
          const data = (await res.json()) as { role: string; permissions: string[] };
          if (Array.isArray(data.permissions)) {
            return data;
          }
        }
      } catch {}

      // Fall back to typed server function
      const res = await fetchPermissions();
      return res as { role: string; permissions: string[] };
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const permissions = query.data?.permissions ?? [];

  const can = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === "admin") return true;
    if (permissions.length > 0) {
      return permissions.includes(permission);
    }
    // Fallback to role-based check
    return checkRolePermission(user.role, permission);
  };

  return {
    permissions,
    role: user?.role,
    isLoading: query.isLoading,
    hasPermission: can,
  };
}
