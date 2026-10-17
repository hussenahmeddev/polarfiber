import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Can } from "@/frontend/components/Can";
import { hasPermission } from "@/shared/permissions";
import * as storeModule from "@/frontend/store";
import type { User } from "@/shared/data";

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Module 10: Reports — Staff Operational vs Admin Financial View", () => {
  const staffUser: User = {
    user_id: 2,
    name: "Staff Analyst",
    email: "staff@polarfiber.com",
    phone: "+251911000000",
    role: "staff",
    must_change_password: false,
  };

  const adminUser: User = {
    user_id: 1,
    name: "System Admin",
    email: "admin@polarfiber.com",
    phone: "+251911000000",
    role: "admin",
    must_change_password: false,
  };

  it("confirms staff has reports.view but lacks revenue.view and reports.export", () => {
    expect(hasPermission("staff", "reports.view")).toBe(true);
    expect(hasPermission("staff", "revenue.view")).toBe(false);
    expect(hasPermission("staff", "reports.export")).toBe(false);

    expect(hasPermission("admin", "reports.view")).toBe(true);
    expect(hasPermission("admin", "revenue.view")).toBe(true);
    expect(hasPermission("admin", "reports.export")).toBe(true);
  });

  it("hides report CSV export buttons for staff users", () => {
    vi.spyOn(storeModule, "useStore").mockReturnValue({
      user: staffUser,
      refreshUser: vi.fn(),
    } as any);

    renderWithClient(
      <div>
        <Can permission="reports.export">
          <button data-testid="export-sales-csv">Export Sales CSV</button>
        </Can>
        <Can permission="reports.export">
          <button data-testid="export-products-csv">Export Products CSV</button>
        </Can>
        <Can permission="reports.export">
          <button data-testid="export-lowstock-csv">Export Low Stock CSV</button>
        </Can>
      </div>,
    );

    expect(screen.queryByTestId("export-sales-csv")).toBeNull();
    expect(screen.queryByTestId("export-products-csv")).toBeNull();
    expect(screen.queryByTestId("export-lowstock-csv")).toBeNull();
  });

  it("renders report CSV export buttons for admin users", () => {
    vi.spyOn(storeModule, "useStore").mockReturnValue({
      user: adminUser,
      refreshUser: vi.fn(),
    } as any);

    renderWithClient(
      <div>
        <Can permission="reports.export">
          <button data-testid="export-sales-csv">Export Sales CSV</button>
        </Can>
        <Can permission="reports.export">
          <button data-testid="export-products-csv">Export Products CSV</button>
        </Can>
        <Can permission="reports.export">
          <button data-testid="export-lowstock-csv">Export Low Stock CSV</button>
        </Can>
      </div>,
    );

    expect(screen.getByTestId("export-sales-csv")).toBeDefined();
    expect(screen.getByTestId("export-products-csv")).toBeDefined();
    expect(screen.getByTestId("export-lowstock-csv")).toBeDefined();
  });
});
