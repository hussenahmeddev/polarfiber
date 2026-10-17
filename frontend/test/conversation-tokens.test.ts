import { describe, it, expect } from "vitest";
import {
  generateConversationToken,
  conversationTokenExpiry,
  isTokenExpired,
  CONVERSATION_TOKEN_VALID_DAYS,
} from "@/utils/conversation-tokens";

describe("Conversation token utilities", () => {
  it("generates a 64-character hex token", () => {
    const token = generateConversationToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateConversationToken()));
    expect(tokens.size).toBe(100);
  });

  it("computes the correct expiry (7 days from now)", () => {
    const before = Date.now();
    const expiry = conversationTokenExpiry();
    const after = Date.now();

    const expectedMin = before + CONVERSATION_TOKEN_VALID_DAYS * 24 * 60 * 60 * 1000;
    const expectedMax = after + CONVERSATION_TOKEN_VALID_DAYS * 24 * 60 * 60 * 1000;

    expect(expiry.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(expiry.getTime()).toBeLessThanOrEqual(expectedMax);
  });

  it("isTokenExpired returns false for future dates", () => {
    const future = new Date(Date.now() + 86400000);
    expect(isTokenExpired(future)).toBe(false);
  });

  it("isTokenExpired returns true for past dates", () => {
    const past = new Date(Date.now() - 86400000);
    expect(isTokenExpired(past)).toBe(true);
  });

  it("isTokenExpired accepts ISO string input", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isTokenExpired(future)).toBe(false);
  });

  it("token has sufficient entropy (32 bytes)", () => {
    const token = generateConversationToken();
    // Hex representation of 32 bytes = 64 chars
    expect(token.length).toBe(64);
    expect(token).not.toMatch(/[^0-9a-f]/);
  });
});
