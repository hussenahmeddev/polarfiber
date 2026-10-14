import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isEmailMatch,
  normalizeOrderNumber,
  parseOrderId,
  toOrderNumber,
} from "@/shared/order-access";
import {
  MESSAGE_MAX_LENGTH,
  isMessageLengthValid,
  preview,
  sanitizeMessage,
} from "@/utils/sanitize";
import { rateLimit, clearRateLimits } from "@/utils/rate-limit";
import { redactSensitive } from "@/utils/audit";

describe("Order number & email matching", () => {
  it("accepts a bare id and the prefixed form", () => {
    expect(parseOrderId(1009)).toBe(1009);
    expect(parseOrderId("1009")).toBe(1009);
    expect(parseOrderId("PF-ORD-1009")).toBe(1009);
    expect(parseOrderId("pf-ord-1009")).toBe(1009);
    expect(parseOrderId("  PF-ORD-1009  ")).toBe(1009);
  });

  it("rejects anything that is not an order number", () => {
    for (const bad of ["", "   ", "abc", "PF-ORD-", "PF-ORD-abc", null, undefined, {}, [], -5, 0]) {
      expect(parseOrderId(bad)).toBeNull();
    }
  });

  it("rejects unsafe or oversized ids", () => {
    expect(parseOrderId("99999999999999999999")).toBeNull();
    expect(parseOrderId(Number.MAX_SAFE_INTEGER + 2)).toBeNull();
  });

  it("normalises for display and lookup", () => {
    expect(normalizeOrderNumber("pf-ord-1009")).toBe("PF-ORD-1009");
    expect(normalizeOrderNumber(1009)).toBe("1009");
    expect(normalizeOrderNumber(null)).toBe("");
    expect(toOrderNumber(1009)).toBe("PF-ORD-1009");
  });

  it("compares emails case-insensitively and rejects non-strings", () => {
    expect(isEmailMatch("A@B.com", "a@b.COM")).toBe(true);
    expect(isEmailMatch(" a@b.com ", "a@b.com")).toBe(true);
    expect(isEmailMatch("a@b.com", "c@d.com")).toBe(false);
    expect(isEmailMatch(null, "a@b.com")).toBe(false);
    expect(isEmailMatch("a@b.com", 42)).toBe(false);
  });
});

describe("Message sanitisation", () => {
  it("keeps plain text intact", () => {
    expect(sanitizeMessage("Can you deliver on Monday?")).toBe("Can you deliver on Monday?");
  });

  it("trims and collapses excess blank lines", () => {
    expect(sanitizeMessage("   hello   ")).toBe("hello");
    expect(sanitizeMessage("a\n\n\n\n\nb")).toBe("a\n\nb");
    expect(sanitizeMessage("line1\r\nline2\r")).toBe("line1\nline2");
  });

  it("preserves newlines and tabs", () => {
    expect(sanitizeMessage("a\nb")).toBe("a\nb");
    expect(sanitizeMessage("a\tb")).toBe("a\tb");
  });

  it("strips control characters", () => {
    expect(sanitizeMessage(`a${String.fromCharCode(0)}b`)).toBe("ab");
    expect(sanitizeMessage(`a${String.fromCharCode(27)}b`)).toBe("ab"); // ESC
    expect(sanitizeMessage(`a${String.fromCharCode(8)}b`)).toBe("ab"); // backspace
    expect(sanitizeMessage(`${String.fromCharCode(7)}a`)).toBe("a"); // BEL
    expect(sanitizeMessage(`a${String.fromCharCode(127)}b`)).toBe("ab"); // DEL
  });

  it("returns empty string for non-strings", () => {
    expect(sanitizeMessage(null)).toBe("");
    expect(sanitizeMessage(undefined)).toBe("");
    expect(sanitizeMessage(42)).toBe("");
    expect(sanitizeMessage({})).toBe("");
  });

  it("does not treat HTML as markup but leaves it unchanged (React escapes on render)", () => {
    const raw = '<img src=x onerror="alert(1)">';
    expect(sanitizeMessage(raw)).toBe(raw);
  });

  it("enforces the 2000 character limit", () => {
    expect(MESSAGE_MAX_LENGTH).toBe(2000);
    expect(isMessageLengthValid("hi")).toBe(true);
    expect(isMessageLengthValid("a".repeat(2000))).toBe(true);
    expect(isMessageLengthValid("a".repeat(2001))).toBe(false);
    expect(isMessageLengthValid("")).toBe(false);
    expect(isMessageLengthValid("   ")).toBe(false);
  });

  it("builds bounded notification previews", () => {
    expect(preview("hello")).toBe("hello");
    expect(preview("a\n\nb")).toBe("a b");
    expect(preview("x".repeat(500)).length).toBeLessThanOrEqual(300);
  });
});

describe("Rate limiting", () => {
  beforeEach(() => clearRateLimits());
  afterEach(() => clearRateLimits());

  it("allows up to the limit then blocks", () => {
    const key = "test:basic";
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    }
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets the window once it expires", () => {
    vi.useFakeTimers();
    try {
      const key = "test:window";
      for (let i = 0; i < 2; i++) rateLimit(key, 2, 60_000);
      expect(rateLimit(key, 2, 60_000).ok).toBe(false);

      vi.advanceTimersByTime(60_001);
      expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps buckets independent per key", () => {
    for (let i = 0; i < 5; i++) rateLimit("test:a", 5, 60_000);
    expect(rateLimit("test:a", 5, 60_000).ok).toBe(false);
    expect(rateLimit("test:b", 5, 60_000).ok).toBe(true);
  });
});

describe("Audit redaction of order access secrets", () => {
  it("redacts access password fields before they can be logged", () => {
    expect(redactSensitive({ access_pass: "$2a$12$secret", ok: 1 })).toEqual({
      access_pass: "[REDACTED]",
      ok: 1,
    });
    expect(redactSensitive({ access_password: "hunter2" })).toEqual({
      access_password: "[REDACTED]",
    });
  });

  it("still redacts the other sensitive keys", () => {
    const out = redactSensitive({
      password: "x",
      password_hash: "y",
      smtp_password: "z",
      api_key: "k",
      order_id: 7,
    }) as Record<string, unknown>;
    expect(out.password).toBe("[REDACTED]");
    expect(out.password_hash).toBe("[REDACTED]");
    expect(out.smtp_password).toBe("[REDACTED]");
    expect(out.api_key).toBe("[REDACTED]");
    expect(out.order_id).toBe(7);
  });
});
