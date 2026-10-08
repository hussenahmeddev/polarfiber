import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboard } from "@/frontend/components/AdminDashboard";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});
