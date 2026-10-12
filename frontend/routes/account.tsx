import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CustomerDashboard } from "@/frontend/components/CustomerDashboard";
import { ProtectedRoute } from "@/frontend/components/ProtectedRoute";

export const Route = createFileRoute("/account")({
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
  component: AccountPage,
});

function AccountPage() {
  return (
    <ProtectedRoute roles={["customer", "admin", "staff"]}>
      <CustomerDashboard />
    </ProtectedRoute>
  );
}
