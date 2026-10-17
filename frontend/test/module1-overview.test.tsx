import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrderDrawer } from "@/frontend/components/OrderDrawer";
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

describe("Module 1: Staff Console Overview & Financial Masking", () => {
  const staffUser: User = {
    user_id: 2,
    name: "Staff User",
    email: "staff@polarfiber.com",
    phone: "+251911000000",
    role: "staff",
    must_change_password: false,
  };

  const adminUser: User = {
    user_id: 1,
    name: "Admin User",
    email: "admin@polarfiber.com",
    phone: "+251911000000",
    role: "admin",
    must_change_password: false,
  };

  const sampleOrder: Order = {
    order_id: 201,
    user_id: null,
    customer: "Dire Dawa Construction",
    items: [
      { product_id: 1, product_name: "Fiber Pipe 200mm", quantity: 5, unit_price: 3200 },
      { product_id: 2, product_name: "Water Tanker 2000L", quantity: 1, unit_price: 24000 },
    ],
    total: 40000,
    status: "Confirmed",
    address: "Dire Dawa, Industrial Zone",
    created_at: "2026-10-15",
  };

  it("hides unit prices and grand total in OrderDrawer when viewed by staff in admin mode", () => {
    vi.spyOn(storeModule, "useStore").mockReturnValue({
      user: staffUser,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
      refreshUser: vi.fn(),
    });

    renderWithClient(
      <OrderDrawer
        order={sampleOrder}
        open={true}
        onOpenChange={vi.fn()}
        mode="admin"
      />
    );

    // Should display order details and quantities
    expect(screen.getByText("Order #201")).toBeDefined();
    expect(screen.getByText("Fiber Pipe 200mm")).toBeDefined();
    expect(screen.getByText("Quantity: 5")).toBeDefined();
    expect(screen.getByText("Quantity: 1")).toBeDefined();

    // Must NOT display unit prices or grand total to staff
    expect(screen.queryByText(/ETB 40,000/)).toBeNull();
    expect(screen.queryByText("Grand Total:")).toBeNull();
  });

  it("displays unit prices and grand total in OrderDrawer when viewed by admin", () => {
    vi.spyOn(storeModule, "useStore").mockReturnValue({
      user: adminUser,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
      refreshUser: vi.fn(),
    });

    renderWithClient(
      <OrderDrawer
        order={sampleOrder}
        open={true}
        onOpenChange={vi.fn()}
        mode="admin"
      />
    );

    expect(screen.getByText("Order #201")).toBeDefined();
    expect(screen.getByText("Grand Total:")).toBeDefined();
    expect(screen.getByText(/ETB\s*40,000/i)).toBeDefined();
  });
});
