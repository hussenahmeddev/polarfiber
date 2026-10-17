import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Can } from "@/frontend/components/Can";
import { ProductDialog } from "@/frontend/components/ProductDialog";
import { hasPermission } from "@/shared/permissions";
import * as storeModule from "@/frontend/store";
import type { User, Product } from "@/shared/data";

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

describe("Module 2: Products — Staff Console Functionality & Permissions", () => {
  const staffUser: User = {
    user_id: 2,
    name: "Staff Operator",
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

  const existingProduct: Product = {
    product_id: 10,
    name: "5,000L Vertical Water Tank",
    sku: "PF-00010",
    slug: "water-tank-5000l",
    category: "Water Tankers",
    capacity: "5,000L",
    price: 45000,
    stock: 8,
    image: "/images/tank-5000.jpg",
    description: "Heavy duty fiberglass tank with UV protection",
    status: "active",
  };

  it("verifies staff has permission to create and update products, but cannot delete or update existing prices", () => {
    expect(hasPermission("staff", "products.view")).toBe(true);
    expect(hasPermission("staff", "products.create")).toBe(true);
    expect(hasPermission("staff", "products.update")).toBe(true);
    expect(hasPermission("staff", "products.delete")).toBe(false);
    expect(hasPermission("staff", "products.update_price")).toBe(false);
  });

  it("renders Add Product button for staff and hides Delete button", () => {
    vi.spyOn(storeModule, "useStore").mockReturnValue({
      user: staffUser,
      refreshUser: vi.fn(),
    } as any);

    renderWithClient(
      <div>
        <Can permission="products.create">
          <button data-testid="add-product-btn">Add Product</button>
        </Can>
        <button data-testid="edit-product-btn">Edit Product</button>
        <Can permission="products.delete">
          <button data-testid="delete-product-btn">Delete Product</button>
        </Can>
      </div>,
    );

    expect(screen.getByTestId("add-product-btn")).toBeDefined();
    expect(screen.getByTestId("edit-product-btn")).toBeDefined();
    expect(screen.queryByTestId("delete-product-btn")).toBeNull();
  });

  it("makes price and SKU read-only for staff when editing an existing product", () => {
    vi.spyOn(storeModule, "useStore").mockReturnValue({
      user: staffUser,
      refreshUser: vi.fn(),
    } as any);

    renderWithClient(
      <ProductDialog
        open={true}
        onOpenChange={vi.fn()}
        product={existingProduct}
        onSave={vi.fn()}
      />,
    );

    const priceInput = screen.getByLabelText(/Price/i);
    const skuInput = screen.getByLabelText(/SKU/i);
    const nameInput = screen.getByLabelText(/Product Name/i);
    const descInput = screen.getByLabelText(/Description/i);

    expect(priceInput).toBeDisabled();
    expect(skuInput).toBeDisabled();
    expect(nameInput).not.toBeDisabled();
    expect(descInput).not.toBeDisabled();
  });

  it("allows staff to input initial price when adding a new product, while SKU remains auto-generated", () => {
    vi.spyOn(storeModule, "useStore").mockReturnValue({
      user: staffUser,
      refreshUser: vi.fn(),
    } as any);

    renderWithClient(
      <ProductDialog
        open={true}
        onOpenChange={vi.fn()}
        product={null}
        onSave={vi.fn()}
      />,
    );

    const priceInput = screen.getByLabelText(/Price/i);
    const skuInput = screen.getByLabelText(/SKU/i);
    const nameInput = screen.getByLabelText(/Product Name/i);

    expect(priceInput).not.toBeDisabled();
    expect(skuInput).toBeDisabled(); // Staff cannot manually override auto-generated SKU
    expect(nameInput).not.toBeDisabled();
  });

  it("allows admin full access to edit SKU and Price on existing products", () => {
    vi.spyOn(storeModule, "useStore").mockReturnValue({
      user: adminUser,
      refreshUser: vi.fn(),
    } as any);

    renderWithClient(
      <ProductDialog
        open={true}
        onOpenChange={vi.fn()}
        product={existingProduct}
        onSave={vi.fn()}
      />,
    );

    const priceInput = screen.getByLabelText(/Price/i);
    const skuInput = screen.getByLabelText(/SKU/i);

    expect(priceInput).not.toBeDisabled();
    expect(skuInput).not.toBeDisabled();
  });
});
