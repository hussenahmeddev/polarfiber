import { withDb } from "../backend/db.server.ts";
import { currentUser } from "../backend/session.server.ts";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

const SENSITIVE_KEYS = new Set([
  "password",
  "password_hash",
  "access_pass",
  "accesspassword",
  "token",
  "refresh_token",
  "smtp_password",
  "apikey",
  "api_key",
  "secret",
  "jwt_secret",
  "session_secret",
]);

export function redactSensitive(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val !== "object") return val;
  if (Array.isArray(val)) {
    return val.map(redactSensitive);
  }
  const redacted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    const lowerKey = k.toLowerCase().replace(/[-_]/g, "");
    if (
      SENSITIVE_KEYS.has(k.toLowerCase()) ||
      lowerKey.includes("password") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("apikey") ||
      (lowerKey.includes("token") && !lowerKey.includes("item") && !lowerKey.includes("total"))
    ) {
      redacted[k] = "[REDACTED]";
    } else if (typeof v === "object" && v !== null) {
      redacted[k] = redactSensitive(v);
    } else {
      redacted[k] = v;
    }
  }
  return redacted;
}

export interface RequestLike {
  user?: { user_id?: number; name?: string };
  ip?: string;
  headers?: { get?(name: string): string | null };
}

/**
 * Logs an administrative create, update, or delete action.
 * Never throws an error or crashes the calling request.
 */
export async function logAction(
  req: RequestLike | null | undefined,
  action: string,
  entityType: string,
  entityId: string | number,
  oldValues: unknown = null,
  newValues: unknown = null,
): Promise<void> {
  try {
    let actorId: number | null = null;
    let actorName: string | null = null;
    let ip: string | null = null;

    if (req && typeof req === "object") {
      if (req.user?.user_id) actorId = req.user.user_id;
      if (req.user?.name) actorName = req.user.name;
      if (req.ip) ip = req.ip;
      else if (req.headers && typeof req.headers.get === "function") {
        ip =
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
      }
    }

    if (!actorId) {
      try {
        const u = await currentUser();
        if (u) {
          actorId = u.user_id;
          actorName = u.name;
        }
      } catch {}
    }

    if (!ip) {
      try {
        ip =
          getRequestIP?.() ||
          getRequestHeader?.("x-forwarded-for")?.split(",")[0]?.trim() ||
          getRequestHeader?.("x-real-ip") ||
          "0.0.0.0";
      } catch {
        ip = "0.0.0.0";
      }
    }

    const cleanOld =
      oldValues !== undefined && oldValues !== null
        ? JSON.stringify(redactSensitive(oldValues))
        : null;
    const cleanNew =
      newValues !== undefined && newValues !== null
        ? JSON.stringify(redactSensitive(newValues))
        : null;

    await withDb(async (c) => {
      await c.execute(
        "INSERT INTO audit_logs (actor_id, actor_name, ip_address, action, entity_type, entity_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          actorId,
          actorName,
          ip ? String(ip) : null,
          String(action),
          String(entityType),
          String(entityId),
          cleanOld,
          cleanNew,
        ],
      );
    });
  } catch (err) {
    console.error("[audit] Failed to log action:", err);
  }
}

export default logAction;
