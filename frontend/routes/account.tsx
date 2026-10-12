import * as React from "react";
import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { ProtectedRoute } from "@/frontend/components/ProtectedRoute";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Dashboard — Polar Fiber" },
      { name: "description", content: "Redirecting to customer dashboard." },
    ],
  }),
  component: AccountRedirectPage,
});

function AccountRedirectPage() {
  const nav = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search }) as Record<string, string>;

  React.useEffect(() => {
    const tab = search?.["tab"];
    const target =
      tab === "orders"
        ? "/dashboard/orders"
        : tab === "quotes"
          ? "/dashboard/quotes"
          : tab === "messages"
            ? "/dashboard/messages"
            : tab === "favorites"
              ? "/dashboard/favorites"
              : tab === "profile"
                ? "/dashboard/profile"
                : tab === "addresses"
                  ? "/dashboard/addresses"
                  : tab === "notifications"
                    ? "/dashboard/notifications"
                    : tab === "support"
                      ? "/dashboard/support"
                      : "/dashboard";

    nav({ to: target, replace: true });
  }, [nav, search]);

  return (
    <ProtectedRoute roles={["customer", "admin", "staff"]}>
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    </ProtectedRoute>
  );
}
