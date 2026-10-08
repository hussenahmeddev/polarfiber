import * as React from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Admin Management — Polar Fiber" },
      { name: "description", content: "Polar Fiber operations, analytics, catalog, orders, and customer management." },
      { property: "og:title", content: "Admin Management — Polar Fiber" },
      { property: "og:description", content: "Polar Fiber operations." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  return <Outlet />;
}
