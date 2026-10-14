import { describe, it, expect } from "vitest";
import {
  ORDER_TRANSITIONS,
  InvalidTransitionError,
  canTransition,
  isTerminal,
  isValidStatus,
  nextStatuses,
  restoresStock,
} from "@/shared/order-status";
import { ORDER_STATUSES, type OrderStatus } from "@/shared/data";

describe("Order status transition rules", () => {
  it("defines a rule for every known status", () => {
    for (const s of ORDER_STATUSES) {
      expect(ORDER_TRANSITIONS[s]).toBeDefined();
      expect(Array.isArray(ORDER_TRANSITIONS[s])).toBe(true);
    }
  });

  it("follows the production workflow", () => {
    expect(canTransition("Pending", "Confirmed")).toBe(true);
    expect(canTransition("Confirmed", "In Production")).toBe(true);
    expect(canTransition("In Production", "Out for Delivery")).toBe(true);
    expect(canTransition("Out for Delivery", "Delivered")).toBe(true);
  });

  it("allows cancellation before dispatch only", () => {
    expect(canTransition("Pending", "Cancelled")).toBe(true);
    expect(canTransition("Confirmed", "Cancelled")).toBe(true);
    expect(canTransition("In Production", "Cancelled")).toBe(true);
    expect(canTransition("Out for Delivery", "Cancelled")).toBe(false);
    expect(canTransition("Delivered", "Cancelled")).toBe(false);
  });

  it("rejects skipped stages", () => {
    expect(canTransition("Pending", "Delivered")).toBe(false);
    expect(canTransition("Pending", "In Production")).toBe(false);
    expect(canTransition("Pending", "Out for Delivery")).toBe(false);
    expect(canTransition("Confirmed", "Out for Delivery")).toBe(false);
    expect(canTransition("Confirmed", "Delivered")).toBe(false);
    expect(canTransition("In Production", "Delivered")).toBe(false);
  });

  it("rejects any change out of a terminal status", () => {
    for (const target of ORDER_STATUSES) {
      expect(canTransition("Delivered", target)).toBe(false);
      expect(canTransition("Cancelled", target)).toBe(false);
    }
  });

  it("treats a no-op as not a transition", () => {
    for (const s of ORDER_STATUSES) {
      expect(canTransition(s, s)).toBe(false);
    }
  });

  it("nextStatuses returns a copy and cannot mutate the source of truth", () => {
    const next = nextStatuses("Pending");
    next.push("Delivered");
    expect(ORDER_TRANSITIONS.Pending).toEqual(["Confirmed", "Cancelled"]);
    expect(nextStatuses("Delivered")).toEqual([]);
  });

  it("identifies terminal statuses", () => {
    expect(isTerminal("Delivered")).toBe(true);
    expect(isTerminal("Cancelled")).toBe(true);
    expect(isTerminal("Pending")).toBe(false);
    expect(isTerminal("Out for Delivery")).toBe(false);
  });

  it("knows when stock must be restored", () => {
    expect(restoresStock("Cancelled")).toBe(true);
    expect(restoresStock("Confirmed")).toBe(false);
  });

  it("validates status strings", () => {
    expect(isValidStatus("Pending")).toBe(true);
    expect(isValidStatus("Nonsense")).toBe(false);
    expect(isValidStatus(42)).toBe(false);
    expect(isValidStatus(null)).toBe(false);
  });

  it("InvalidTransitionError carries a 403 status and a readable message", () => {
    const err = new InvalidTransitionError("Pending", "Delivered");
    expect(err.status).toBe(403);
    expect(err.message).toContain("Pending");
    expect(err.message).toContain("Delivered");
    expect(err.name).toBe("InvalidTransitionError");
    expect(err instanceof Error).toBe(true);
  });

  it("matches the dropdown options a user should see", () => {
    const expected: Record<OrderStatus, OrderStatus[]> = {
      Pending: ["Confirmed", "Cancelled"],
      Confirmed: ["In Production", "Cancelled"],
      "In Production": ["Out for Delivery", "Cancelled"],
      "Out for Delivery": ["Delivered"],
      Delivered: [],
      Cancelled: [],
    };
    for (const s of ORDER_STATUSES) {
      expect(nextStatuses(s)).toEqual(expected[s]);
    }
  });
});
