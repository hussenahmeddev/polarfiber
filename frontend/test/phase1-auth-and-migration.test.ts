import { describe, it, expect } from "vitest";
import { assertRole, assertAdmin, assertStaffOrAdmin } from "@/backend/session.server";
import type { Role, User } from "@/shared/data";

describe("Phase 1: Migration & Staff Auth", () => {
  describe("Role Assertions (assertRole)", () => {
    it("allows authorized role", () => {
      expect(() => assertRole("staff", "staff", "admin")).not.toThrow();
      expect(() => assertRole("admin", "admin")).not.toThrow();
      expect(() => assertRole("customer", "customer")).not.toThrow();
    });

    it("rejects unauthorized role with 403 Forbidden", () => {
      expect(() => assertRole("customer", "admin", "staff")).toThrowError(
        expect.objectContaining({ status: 403, message: "Forbidden" }),
      );
    });
  });

  describe("Admin Assertions (assertAdmin)", () => {
    it("allows active admin user", () => {
      const adminUser: User = {
        user_id: 1,
        name: "Admin User",
        email: "admin@polarfiber.com",
        phone: "+251911000000",
        role: "admin",
        must_change_password: false,
      };
      expect(() => assertAdmin(adminUser)).not.toThrow();
    });

    it("rejects non-admin (staff or customer) with 403", () => {
      const staffUser: User = {
        user_id: 2,
        name: "Staff User",
        email: "staff@polarfiber.com",
        phone: "+251911000000",
        role: "staff",
        must_change_password: false,
      };
      expect(() => assertAdmin(staffUser)).toThrowError(expect.objectContaining({ status: 403 }));
    });

    it("rejects admin with must_change_password=true with 403", () => {
      const tempAdmin: User = {
        user_id: 3,
        name: "Temp Admin",
        email: "tempadmin@polarfiber.com",
        phone: "+251911000000",
        role: "admin",
        must_change_password: true,
      };
      expect(() => assertAdmin(tempAdmin)).toThrowError(expect.objectContaining({ status: 403 }));
    });
  });

  describe("Staff or Admin Assertions (assertStaffOrAdmin)", () => {
    it("rejects customer users with 403", () => {
      const customerUser: User = {
        user_id: 10,
        name: "Customer User",
        email: "cust@example.com",
        phone: "",
        role: "customer",
        must_change_password: false,
      };
      expect(() => assertStaffOrAdmin(customerUser)).toThrowError(
        expect.objectContaining({ status: 403 }),
      );
    });

    it("rejects staff users who still need to change temporary password with 403", () => {
      const staffUser: User = {
        user_id: 20,
        name: "New Staff",
        email: "newstaff@polarfiber.com",
        phone: "+251911000000",
        role: "staff",
        must_change_password: true,
      };
      expect(() => assertStaffOrAdmin(staffUser)).toThrowError(
        expect.objectContaining({ status: 403 }),
      );
    });

    it("allows staff users who have completed temporary password change", () => {
      const staffUser: User = {
        user_id: 20,
        name: "Active Staff",
        email: "activestaff@polarfiber.com",
        phone: "+251911000000",
        role: "staff",
        must_change_password: false,
      };
      expect(() => assertStaffOrAdmin(staffUser)).not.toThrow();
    });

    it("allows active admin users", () => {
      const adminUser: User = {
        user_id: 1,
        name: "Admin User",
        email: "admin@polarfiber.com",
        phone: "+251911000000",
        role: "admin",
        must_change_password: false,
      };
      expect(() => assertStaffOrAdmin(adminUser)).not.toThrow();
    });
  });
});
