import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Can } from "@/frontend/components/Can";
import { OrderDrawer } from "@/frontend/components/OrderDrawer";
import { canTransition } from "@/shared/order-status";
import { hasPermission } from "@/shared/permissions";
import * as storeModule from "@/frontend/store";
import type { User, Order } from "@/shared/data";

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

describe("Module 5: Orders — Staff Console Functionality & Gating", () => {
  const staffUser: User = {
    user_id: 2,
    name: "Staff Logistics",
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

  const sampleOrder: Order = {
    order_id: 301,
    user_id: 8,
    customer: "Awash Wine SC",
    items: [
      { product_id: 1, product_name: "10,000L Industrial Tanker", quantity: 2, unit_price: 92000 },
    ],
    total: 184000,
    status: "Confirmed",
    address: "Addis Ababa, Saris Industrial Area",
    created_at: "2026-10-16",
    payment_method: "telebirr",
    is_paid: true,
  };

  it("prohibits staff from exporting orders CSV while allowing admin", () => {
    expect(hasPermission("staff", "reports.export")).toBe(false);
    expect(hasPermission("admin", "reports.export")).toBe(true);

    // Staff view: Export CSV button is not rendered
    vi.spyOn(storeModule, "useStore").mockReturnValue({
      user: staffUser,
      refreshUser: vi.fn(),
    } as any);

    const { rerender } = renderWithClient(
      <Can permission="reports.export">
        <button data-testid="export-orders-csv">Export CSV</button>
      </Can>,
    );

    expect(screen.queryByTestId("export-orders-csv")).toBeNull();

    // Admin view: Export CSV button is rendered
    vi.spyOn(storeModule, "useStore").mockReturnValue({
      user: adminUser,
      refreshUser: vi.fn(),
    } as any);

    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Can permission="reports.export">
          <button data-testid="export-orders-csv">Export CSV</button>
        </Can>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("export-orders-csv")).toBeDefined();
  });

  it("enforces permitted status transitions and blocks illegal shortcuts", () => {
    // Confirmed -> In Production is permitted
    expect(canTransition("Confirmed", "In Production")).toBe(true);
    // Confirmed -> Cancelled is permitted
    expect(canTransition("Confirmed", "Cancelled")).toBe(true);
    // Confirmed -> Delivered directly is forbidden
    expect(canTransition("Confirmed", "Delivered")).toBe(false);
    // Delivered is terminal: cannot go to Cancelled or In Production
    expect(canTransition("Delivered", "Cancelled")).toBe(false);
    expect(canTransition("Delivered", "In Production")).toBe(false);
  });

  it("prevents staff from modifying payment status or cancelling dispatched orders", () => {
    expect(hasPermission("staff", "orders.mark_paid")).toBe(false);
    expect(hasPermission("staff", "orders.cancel_after_dispatch")).toBe(false);
    expect(hasPermission("admin", "orders.mark_paid")).toBe(true);
    expect(hasPermission("admin", "orders.cancel_after_dispatch")).toBe(true);
  });

  it("renders OrderDrawer with customer details, order items, and delivery address for staff", () => {
    vi.spyOn(storeModule, "useStore").mockReturnValue({
      user: staffUser,
      refreshUser: vi.fn(),
    } as any);

    renderWithClient(
      <OrderDrawer
        order={sampleOrder}
        open={true}
        mode="admin"
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Awash Wine SC/i)).toBeDefined();
    expect(screen.getByText(/10,000L Industrial Tanker/i)).toBeDefined();
    expect(screen.getAllByText(/Addis Ababa, Saris Industrial Area/i).length).toBeGreaterThan(0);
  });
});
