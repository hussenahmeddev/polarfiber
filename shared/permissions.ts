import type { Role } from "./data";

export const STAFF_PERMISSIONS = [
  "dashboard.view",
  "products.view",
  "products.update",
  "inventory.view",
  "inventory.adjust",
  "orders.view",
  "orders.update_status",
  "orders.add_note",
  "quotes.view",
  "quotes.respond",
  "customers.view",
  "messages.view",
  "messages.reply",
  "messages.archive",
  "support.view",
  "support.reply",
  "support.update_status",
  "profile.update",
  "categories.view",
  "reports.view",
  "settings.view",
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

export const FORBIDDEN_STAFF_PERMISSIONS = [
  "products.create",
  "products.delete",
  "products.update_price",
  "categories.create",
  "categories.update",
  "categories.delete",
  "inventory.adjust_unlimited",
  "orders.mark_paid",
  "orders.cancel_after_dispatch",
  "customers.block",
  "customers.export",
  "reports.export",
  "audit.view",
  "settings.update",
  "team.view",
  "team.create",
  "team.update",
  "team.delete",
  "revenue.view",
] as const;

export const ALL_PERMISSIONS = [
  ...STAFF_PERMISSIONS,
  ...FORBIDDEN_STAFF_PERMISSIONS,
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number] | string;

/**
 * Checks whether a given role has the requested permission.
 * - Admin has all permissions.
 * - Staff has the explicit STAFF_PERMISSIONS set, excluding anything in categories.*,
 *   reports.*, audit.*, settings.*, team.*, and prohibited product/order/customer actions.
 * - Customer has no admin/staff management permissions.
 */
export function hasPermission(role: Role | undefined | null, permission: string): boolean {
  if (!role || role === "customer") return false;
  if (role === "admin") return true;

  if (role === "staff") {
    // Check wildcard prefixes forbidden for staff (but allow .view for categories, reports, settings)
    if (
      (permission.startsWith("categories.") && permission !== "categories.view") ||
      (permission.startsWith("reports.") && permission !== "reports.view") ||
      (permission.startsWith("settings.") && permission !== "settings.view") ||
      permission.startsWith("audit.") ||
      permission.startsWith("team.")
    ) {
      return false;
    }

    // Prohibited specific actions
    if (
      permission === "inventory.adjust_unlimited" ||
      permission === "products.delete" ||
      permission === "products.update_price" ||
      permission === "orders.mark_paid" ||
      permission === "orders.cancel_after_dispatch" ||
      permission === "customers.block" ||
      permission === "customers.export" ||
      permission === "revenue.view"
    ) {
      return false;
    }

    return (STAFF_PERMISSIONS as readonly string[]).includes(permission);
  }

  return false;
}

/**
 * Returns all permission strings granted to the given role.
 */
export function getPermissionsForRole(role: Role | undefined | null): string[] {
  if (!role || role === "customer") return [];
  if (role === "admin") return [...ALL_PERMISSIONS];
  if (role === "staff") return [...STAFF_PERMISSIONS];
  return [];
}
