import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Can } from "@/frontend/components/Can";
import { ADMIN_NAV_ITEMS } from "@/frontend/components/AdminSidebarLayout";
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

describe("Phase 3: Sidebar, Route Guard, and <Can> Component", () => {
  describe("Sidebar Nav Items Permission Filtering", () => {
    it("staff role sees permitted modules (Categories, Reports, Settings visible; Audit Logs hidden)", () => {
      const staffVisible = ADMIN_NAV_ITEMS.filter((item) => {
        if (!item.permission) return true;
        return hasPermission("staff", item.permission);
      });

      const ids = staffVisible.map((i) => i.id);

      // Permitted items are visible
      expect(ids).toContain("overview");
      expect(ids).toContain("products");
      expect(ids).toContain("inventory");
      expect(ids).toContain("orders");
      expect(ids).toContain("quotes");
      expect(ids).toContain("customers");
      expect(ids).toContain("messages");
      expect(ids).toContain("support");
      expect(ids).toContain("settings");
      expect(ids).toContain("categories");
      expect(ids).toContain("reports");

      // Forbidden modules are strictly HIDDEN
      expect(ids).not.toContain("audit-logs");
      expect(staffVisible.length).toBe(11);
    });

    it("admin role sees all 12 modules including Categories, Reports, Audit Logs", () => {
      const adminVisible = ADMIN_NAV_ITEMS.filter((item) => {
        if (!item.permission) return true;
        return hasPermission("admin", item.permission);
      });

      expect(adminVisible.length).toBe(12);
      const ids = adminVisible.map((i) => i.id);
      expect(ids).toContain("categories");
      expect(ids).toContain("reports");
      expect(ids).toContain("audit-logs");
    });
  });

  describe("<Can> Component Conditional Rendering", () => {
    it("renders children when staff user has permitted action", () => {
      const staffUser: User = {
        user_id: 8,
        name: "Staff User",
        email: "staff@polarfiber.com",
        phone: "",
        role: "staff",
        must_change_password: false,
      };

      vi.spyOn(storeModule, "useStore").mockReturnValue({
        user: staffUser,
      } as any);

      renderWithClient(
        <Can permission="products.update">
          <button data-testid="edit-btn">Edit Product</button>
        </Can>,
      );

      expect(screen.getByTestId("edit-btn")).toBeDefined();
    });

    it("hides children when staff user lacks permission (e.g. products.delete)", () => {
      const staffUser: User = {
        user_id: 8,
        name: "Staff User",
        email: "staff@polarfiber.com",
        phone: "",
        role: "staff",
        must_change_password: false,
      };

      vi.spyOn(storeModule, "useStore").mockReturnValue({
        user: staffUser,
      } as any);

      renderWithClient(
        <Can permission="products.delete">
          <button data-testid="delete-btn">Delete Product</button>
        </Can>,
      );

      expect(screen.queryByTestId("delete-btn")).toBeNull();
    });

    it("renders fallback when permission is missing", () => {
      const staffUser: User = {
        user_id: 8,
        name: "Staff User",
        email: "staff@polarfiber.com",
        phone: "",
        role: "staff",
        must_change_password: false,
      };

      vi.spyOn(storeModule, "useStore").mockReturnValue({
        user: staffUser,
      } as any);

      renderWithClient(
        <Can
          permission="team.update"
          fallback={<span data-testid="read-only-role">Read Only</span>}
        >
          <button data-testid="change-role-btn">Change Role</button>
        </Can>,
      );

      expect(screen.queryByTestId("change-role-btn")).toBeNull();
      expect(screen.getByTestId("read-only-role")).toBeDefined();
    });

    it("renders children for admin user on all actions", () => {
      const adminUser: User = {
        user_id: 1,
        name: "Admin User",
        email: "admin@polarfiber.com",
        phone: "",
        role: "admin",
        must_change_password: false,
      };

      vi.spyOn(storeModule, "useStore").mockReturnValue({
        user: adminUser,
      } as any);

      renderWithClient(
        <Can permission="products.delete">
          <button data-testid="admin-delete-btn">Delete</button>
        </Can>,
      );

      expect(screen.getByTestId("admin-delete-btn")).toBeDefined();
    });
  });
});
