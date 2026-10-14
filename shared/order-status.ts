import { ORDER_STATUSES, type OrderStatus } from "./data";

/**
 * Authoritative order status transition rules.
 *
 * These mirror the behaviour already enforced staff-side in setOrderStatus
 * (backend/api.functions.ts) and are now applied to BOTH staff and admin so no
 * invalid transition can be recorded, e.g. Pending → Delivered, or any change
 * to a terminal order.
 *
 * Workflow: Pending → Confirmed → In Production → Out for Delivery → Delivered.
 * Cancelled is allowed from any stage before dispatch; a delivered or cancelled
 * order is final.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["In Production", "Cancelled"],
  "In Production": ["Out for Delivery", "Cancelled"],
  "Out for Delivery": ["Delivered"],
  Delivered: [],
  Cancelled: [],
};

/** Statuses after which an order can no longer be modified. */
export const TERMINAL_STATUSES: readonly OrderStatus[] = ["Delivered", "Cancelled"];

export function isValidStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  // Same status is a no-op: never a transition, never a history entry.
  if (from === to) return false;
  const allowed = ORDER_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/** Statuses a user may move this order to (safe to render in a dropdown). */
export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return [...(ORDER_TRANSITIONS[from] ?? [])];
}

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** True when moving to this status must restore stock (cancellation). */
export function restoresStock(to: OrderStatus): boolean {
  return to === "Cancelled";
}

/**
 * Thrown when a status change is not allowed. `status` is the HTTP status the
 * server function should return.
 */
export class InvalidTransitionError extends Error {
  status = 403;
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`Invalid order status transition from ${from} to ${to}.`);
    this.name = "InvalidTransitionError";
  }
}
