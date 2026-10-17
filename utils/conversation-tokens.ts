import { randomBytes } from "node:crypto";

/** Number of days a conversation token remains valid. */
export const CONVERSATION_TOKEN_VALID_DAYS = 7;

/**
 * Generates a cryptographically secure random token for conversation access.
 * Returns a 64-character hex string (32 bytes of entropy).
 */
export function generateConversationToken(): string {
  return randomBytes(32).toString("hex");
}

/** Computes the expiry date for a new conversation token. */
export function conversationTokenExpiry(): Date {
  return new Date(Date.now() + CONVERSATION_TOKEN_VALID_DAYS * 24 * 60 * 60 * 1000);
}

/** Returns true if a token has not yet expired. */
export function isTokenExpired(expiresAt: string | Date): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

export type ConversationType = "quote" | "contact_message";
