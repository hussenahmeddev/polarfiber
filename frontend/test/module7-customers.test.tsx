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

describe("Module 7: Customers — Staff Permissions & Financial Masking", () => {
  const staffUser: User = {
    user_id: 2,
    name: "Staff Representative",
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

  it("verifies staff can view customers but cannot block or export", () => {
    expect(hasPermission("staff", "customers.view")).toBe(true);
    expect(hasPermission("staff", "customers.block")).toBe(false);
    expect(hasPermission("staff", "customers.export")).toBe(false);
    expect(hasPermission("staff", "revenue.view")).toBe(false);

    expect(hasPermission("admin", "customers.view")).toBe(true);
    expect(hasPermission("admin", "customers.block")).toBe(true);
    expect(hasPermission("admin", "customers.export")).toBe(true);
    expect(hasPermission("admin", "revenue.view")).toBe(true);
  });

  it("hides Block Customer and Export CSV buttons for staff", () => {
    vi.spyOn(storeModule, "useStore").mockReturnValue({
      user: staffUser,
      refreshUser: vi.fn(),
    } as any);

    renderWithClient(
      <div>
        <Can permission="customers.block">
          <button data-testid="block-customer-btn">Block Customer</button>
        </Can>
        <Can permission="customers.export">
          <button data-testid="export-customers-btn">Export CSV</button>
        </Can>
      </div>,
    );

    expect(screen.queryByTestId("block-customer-btn")).toBeNull();
    expect(screen.queryByTestId("export-customers-btn")).toBeNull();
  });

  it("renders Block Customer and Export CSV buttons for admin", () => {
    vi.spyOn(storeModule, "useStore").mockReturnValue({
      user: adminUser,
      refreshUser: vi.fn(),
    } as any);

    renderWithClient(
      <div>
        <Can permission="customers.block">
          <button data-testid="block-customer-btn">Block Customer</button>
        </Can>
        <Can permission="customers.export">
          <button data-testid="export-customers-btn">Export CSV</button>
        </Can>
      </div>,
    );

    expect(screen.getByTestId("block-customer-btn")).toBeDefined();
    expect(screen.getByTestId("export-customers-btn")).toBeDefined();
  });
});
