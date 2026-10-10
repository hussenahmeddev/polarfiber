import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Can } from "@/frontend/components/Can";
import { ProductDialog } from "@/frontend/components/ProductDialog";
import { OrderDrawer } from "@/frontend/components/OrderDrawer";
import { hasPermission } from "@/shared/permissions";
import * as storeModule from "@/frontend/store";
import type { User, Order, Product } from "@/shared/data";

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

describe("Phase 4: Staff vs Admin Dashboard Filtering & Actions", () => {
  const staffUser: User = {
    user_id: 2,
    name: "Abebe Staff",
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
    order_id: 101,
    user_id: 5,
    customer: "Awash Brewery",
    items: [{ product_id: 1, product_name: "10,000L Tanker", quantity: 2, unit_price: 92000 }],
    total: 184000,
    status: "Confirmed",
    address: "Addis Ababa, Bole",
    internal_notes: "[2026-10-09 - Admin]: Priority delivery requested by site engineer.",
    created_at: "2026-10-09",
  };

  const sampleProduct: Product = {
    product_id: 1,
    name: "Polar Tanker 5,000L",
    category: "Water Tankers",
    capacity: "5,000 L",
    price: 48000,
    stock: 12,
    image: "https://example.com/tank.jpg",
    description: "Reinforced fiberglass tank",
  };

  describe("Overview & Revenue Filtering", () => {
    it("hides Revenue and financial cards when viewed by staff", () => {
      vi.spyOn(storeModule, "useStore").mockReturnValue({
        user: staffUser,
        refreshUser: vi.fn(),
      } as any);

      renderWithClient(
        <div>
          <Can permission="revenue.view">
            <div data-testid="revenue-card">Revenue (Delivered): ETB 500,000</div>
          </Can>
          <div data-testid="orders-card">Total Orders: 45</div>
        </div>,
      );

      expect(screen.queryByTestId("revenue-card")).toBeNull();
      expect(screen.getByTestId("orders-card")).toBeDefined();
    });

    it("displays Revenue card when viewed by admin", () => {
      vi.spyOn(storeModule, "useStore").mockReturnValue({
        user: adminUser,
        refreshUser: vi.fn(),
      } as any);

      renderWithClient(
        <div>
          <Can permission="revenue.view">
            <div data-testid="revenue-card">Revenue (Delivered): ETB 500,000</div>
          </Can>
          <div data-testid="orders-card">Total Orders: 45</div>
        </div>,
      );

      expect(screen.getByTestId("revenue-card")).toBeDefined();
    });
  });

  describe("Products Catalog & Dialog Controls", () => {
    it("hides Add Product and Delete Product buttons for staff", () => {
      vi.spyOn(storeModule, "useStore").mockReturnValue({
        user: staffUser,
        refreshUser: vi.fn(),
      } as any);

      renderWithClient(
        <div>
          <Can permission="products.create">
            <button data-testid="add-product-btn">Add Product</button>
          </Can>
          <button data-testid="edit-product-btn">Edit</button>
          <Can permission="products.delete">
            <button data-testid="delete-product-btn">Delete</button>
          </Can>
        </div>,
      );

      expect(screen.queryByTestId("add-product-btn")).toBeNull();
      expect(screen.queryByTestId("delete-product-btn")).toBeNull();
      expect(screen.getByTestId("edit-product-btn")).toBeDefined();
    });

    it("disables Price field in ProductDialog for staff users", () => {
      vi.spyOn(storeModule, "useStore").mockReturnValue({
        user: staffUser,
        refreshUser: vi.fn(),
      } as any);

      renderWithClient(
        <ProductDialog
          open={true}
          onOpenChange={vi.fn()}
          product={sampleProduct}
          onSave={vi.fn()}
        />,
      );

      const priceInput = screen.getByLabelText(/Price \(ETB\)/i) as HTMLInputElement;
      expect(priceInput.disabled).toBe(true);
    });

    it("enables Price field in ProductDialog for admin users", () => {
      vi.spyOn(storeModule, "useStore").mockReturnValue({
        user: adminUser,
        refreshUser: vi.fn(),
      } as any);

      renderWithClient(
        <ProductDialog
          open={true}
          onOpenChange={vi.fn()}
          product={sampleProduct}
          onSave={vi.fn()}
        />,
      );

      const priceInput = screen.getByLabelText(/Price \(ETB\)/i) as HTMLInputElement;
      expect(priceInput.disabled).toBe(false);
    });
  });

  describe("Order Drawer: Notes and Actions", () => {
    it("displays internal notes in admin/staff mode and hides Refund/Delete for staff", () => {
      vi.spyOn(storeModule, "useStore").mockReturnValue({
        user: staffUser,
        refreshUser: vi.fn(),
      } as any);

      renderWithClient(
        <OrderDrawer
          order={sampleOrder}
          open={true}
          onOpenChange={vi.fn()}
          mode="admin"
          onStatusChange={vi.fn()}
          onAddNote={vi.fn()}
        />,
      );

      // Staff can see internal confidential notes
      expect(screen.getByText(/Staff Internal Notes/i)).toBeDefined();
      expect(screen.getByText(/Priority delivery requested/i)).toBeDefined();

      // Refund and Delete buttons are strictly hidden for staff
      expect(screen.queryByText(/Refund Order/i)).toBeNull();
      expect(screen.queryByText(/Delete Order/i)).toBeNull();
    });

    it("displays Refund and Delete buttons in OrderDrawer for admin", () => {
      vi.spyOn(storeModule, "useStore").mockReturnValue({
        user: adminUser,
        refreshUser: vi.fn(),
      } as any);

      renderWithClient(
        <OrderDrawer
          order={sampleOrder}
          open={true}
          onOpenChange={vi.fn()}
          mode="admin"
          onStatusChange={vi.fn()}
          onAddNote={vi.fn()}
        />,
      );

      expect(screen.getByText(/Refund Order/i)).toBeDefined();
      expect(screen.getByText(/Delete Order/i)).toBeDefined();
    });
  });

  describe("Contact Messages & Support Tickets Permissions", () => {
    it("allows staff to archive messages but hides Delete button", () => {
      vi.spyOn(storeModule, "useStore").mockReturnValue({
        user: staffUser,
        refreshUser: vi.fn(),
      } as any);

      renderWithClient(
        <div>
          <button data-testid="archive-btn">Archive</button>
          <Can permission="messages.delete">
            <button data-testid="delete-msg-btn">Delete Message</button>
          </Can>
        </div>,
      );

      expect(screen.getByTestId("archive-btn")).toBeDefined();
      expect(screen.queryByTestId("delete-msg-btn")).toBeNull();
    });

    it("verifies staff permission map restricts settings, team creation, categories and reports", () => {
      expect(hasPermission("staff", "settings.view")).toBe(false);
      expect(hasPermission("staff", "team.create")).toBe(false);
      expect(hasPermission("staff", "categories.view")).toBe(false);
      expect(hasPermission("staff", "reports.view")).toBe(false);
      expect(hasPermission("staff", "inventory.adjust_unlimited")).toBe(false);

      // Staff allowed capabilities
      expect(hasPermission("staff", "inventory.adjust")).toBe(true);
      expect(hasPermission("staff", "orders.add_note")).toBe(true);
      expect(hasPermission("staff", "support.reply")).toBe(true);
    });
  });
});
