import { createHmac, timingSafeEqual } from "node:crypto";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { withDb, rows } from "./db.server";
import type { User } from "../shared/data";

const COOKIE = "pf_session";
const MAX_AGE = 60 * 60 * 24 * 14;

function sign(v: string) {
  const secret = process.env["SESSION_SECRET"] || "polarfiber-dev-secret-key-change-in-production";
  return createHmac("sha256", secret).update(v).digest("base64url");
}

export function startSession(userId: number) {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE * 1000 }),
  ).toString("base64url");
  setCookie(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function endSession() {
  deleteCookie(COOKIE, { path: "/" });
}

export function sessionUserId(): number | null {
  const raw = getCookie(COOKIE);
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const a = Buffer.from(sig),
    b = Buffer.from(sign(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString());
    return d.exp > Date.now() ? Number(d.uid) : null;
  } catch {
    return null;
  }
}

export type SessionUser = User;

export async function currentUser(): Promise<SessionUser | null> {
  const uid = sessionUserId();
  if (!uid) return null;
  return withDb(async (c) => {
    const r = await rows<SessionUser>(
      c,
      `SELECT u.user_id,u.name,u.email,u.phone,
        IF(EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.user_id AND r.role='admin'),'admin','customer') role
       FROM users u WHERE u.user_id=?`,
      [uid],
    );
    return r[0] ?? null;
  });
}

export async function requireUser() {
  const u = await currentUser();
  if (!u) throw new Error("Please sign in first.");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "admin") throw new Error("Admins only.");
  return u;
}
