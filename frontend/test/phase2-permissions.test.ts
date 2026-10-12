import { describe, it, expect } from "vitest";
import {
  hasPermission,
  getPermissionsForRole,
  STAFF_PERMISSIONS,
  FORBIDDEN_STAFF_PERMISSIONS,
} from "@/shared/permissions";
import { assertPermission } from "@/backend/session.server";
import type { User } from "@/shared/data";

describe("Phase 2: Permission Middleware and Map", () => {
  const staffUser: User = {
    user_id: 8,
    name: "Staff Member",
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

  const customerUser: User = {
    user_id: 5,
    name: "Test Customer",
    email: "customer@example.com",
    phone: "",
    role: "customer",
    must_change_password: false,
  };

  describe("Permission Map (hasPermission)", () => {
    it("staff role HAS all expected staff capabilities", () => {
      for (const perm of STAFF_PERMISSIONS) {
        expect(hasPermission("staff", perm)).toBe(true);
      }
    });

    it("staff role DOES NOT have any forbidden capabilities", () => {
      for (const perm of FORBIDDEN_STAFF_PERMISSIONS) {
        expect(hasPermission("staff", perm)).toBe(false);
      }
    });

    it("staff role has .view for categories, reports, settings but NOT manage/create/update/delete", () => {
      // Staff CAN view these
      expect(hasPermission("staff", "categories.view")).toBe(true);
      expect(hasPermission("staff", "reports.view")).toBe(true);
      expect(hasPermission("staff", "settings.view")).toBe(true);

      // Staff CANNOT manage/create/update/delete these
      expect(hasPermission("staff", "categories.create")).toBe(false);
      expect(hasPermission("staff", "categories.update")).toBe(false);
      expect(hasPermission("staff", "categories.delete")).toBe(false);
      expect(hasPermission("staff", "categories.manage")).toBe(false);
      expect(hasPermission("staff", "reports.export")).toBe(false);
      expect(hasPermission("staff", "reports.manage")).toBe(false);
      expect(hasPermission("staff", "settings.update")).toBe(false);
      expect(hasPermission("staff", "settings.manage")).toBe(false);

      // Staff CANNOT access audit.* or team.* at all
      expect(hasPermission("staff", "audit.view")).toBe(false);
      expect(hasPermission("staff", "audit.manage")).toBe(false);
      expect(hasPermission("staff", "team.view")).toBe(false);
      expect(hasPermission("staff", "team.create")).toBe(false);
      expect(hasPermission("staff", "team.update")).toBe(false);
      expect(hasPermission("staff", "team.delete")).toBe(false);
      expect(hasPermission("staff", "team.manage")).toBe(false);
    });

    it("admin role has all permissions", () => {
      for (const perm of [...STAFF_PERMISSIONS, ...FORBIDDEN_STAFF_PERMISSIONS]) {
        expect(hasPermission("admin", perm)).toBe(true);
      }
    });

    it("customer role has no staff/admin permissions", () => {
      for (const perm of STAFF_PERMISSIONS) {
        expect(hasPermission("customer", perm)).toBe(false);
      }
    });
  });

  describe("Server Permission Assertion (assertPermission / requirePermission)", () => {
    it("allows staff user to perform all granted actions", () => {
      for (const perm of STAFF_PERMISSIONS) {
        expect(() => assertPermission(staffUser, perm)).not.toThrow();
      }
    });

    it("staff user gets 403 on EVERY forbidden action", () => {
      for (const forbiddenPerm of FORBIDDEN_STAFF_PERMISSIONS) {
        expect(() => assertPermission(staffUser, forbiddenPerm)).toThrowError(
          expect.objectContaining({
            status: 403,
            message: `Forbidden: missing permission '${forbiddenPerm}'`,
          }),
        );
      }
    });

    it("allows admin user to perform any action without error", () => {
      for (const perm of [...STAFF_PERMISSIONS, ...FORBIDDEN_STAFF_PERMISSIONS]) {
        expect(() => assertPermission(adminUser, perm)).not.toThrow();
      }
    });

    it("customer user gets 403 on all management permissions", () => {
      for (const perm of STAFF_PERMISSIONS) {
        expect(() => assertPermission(customerUser, perm)).toThrowError(
          expect.objectContaining({ status: 403 }),
        );
      }
    });

    it("staff user with must_change_password=true gets 403 even on permitted actions", () => {
      const lockedStaff: User = {
        ...staffUser,
        must_change_password: true,
      };

      for (const perm of STAFF_PERMISSIONS) {
        expect(() => assertPermission(lockedStaff, perm)).toThrowError(
          expect.objectContaining({ status: 403 }),
        );
      }
    });
  });

  describe("getPermissionsForRole helper", () => {
    it("returns complete list for admin, curated list for staff, empty for customer", () => {
      const adminPerms = getPermissionsForRole("admin");
      const staffPerms = getPermissionsForRole("staff");
      const customerPerms = getPermissionsForRole("customer");

      expect(adminPerms.length).toBeGreaterThan(staffPerms.length);
      expect(staffPerms).toEqual([...STAFF_PERMISSIONS]);
      expect(customerPerms).toEqual([]);
    });
  });
});
