import { createHmac, createHash, timingSafeEqual, randomBytes } from "node:crypto";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { withDb, rows } from "./db.server";
import type { User, Role } from "../shared/data";

// ─── Legacy HMAC session (kept for backward compat) ───────────────────────────
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
    // "none" + partitioned lets the cookie work when the site is shown inside
    // an embedded frame (such as the editor preview). Cross-site requests are
    // still blocked by the CSRF middleware in start.ts.
    sameSite: "none",
    partitioned: true,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function endSession() {
  deleteCookie(COOKIE, { path: "/", secure: true, sameSite: "none", partitioned: true });
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

// ─── JWT access token + refresh token ─────────────────────────────────────────
const ACCESS_COOKIE = "pf_access";
const REFRESH_COOKIE = "pf_refresh";
const ACCESS_TTL = 15 * 60; // 15 minutes in seconds
const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

function jwtSecret(): string {
  const s =
    process.env["JWT_SECRET"] ||
    process.env["SESSION_SECRET"] ||
    "polarfiber-dev-secret-key-change-in-production";
  return process.env["JWT_SECRET"] ? s : s + "-jwt";
}

function b64url(s: string): string {
  return Buffer.from(s).toString("base64url");
}

function signJwt(payload: object): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", jwtSecret())
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

function sha256hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function issueTokenPair(userId: number, userAgent: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = signJwt({ uid: userId, exp: now + ACCESS_TTL });
  setCookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TTL,
  });

  const plainRefresh = randomBytes(32).toString("hex");
  const refreshHash = sha256hex(plainRefresh);
  try {
    await withDb((c) =>
      c.execute(
        "INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY), ?)",
        [userId, refreshHash, userAgent.slice(0, 512)],
      ),
    );
    setCookie(REFRESH_COOKIE, plainRefresh, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_TTL,
    });
  } catch {
    // refresh_tokens table may not exist yet — login still works via HMAC session
  }
}

export async function revokeRefreshToken(tokenHash: string): Promise<void> {
  await withDb((c) =>
    c.execute("UPDATE refresh_tokens SET revoked_at=NOW() WHERE token_hash=?", [tokenHash]),
  );
}

export async function rotateRefreshToken(
  oldTokenHash: string,
  userId: number,
  userAgent: string,
): Promise<void> {
  await revokeRefreshToken(oldTokenHash);
  await issueTokenPair(userId, userAgent);
}

export function verifyAccessToken(): { uid: number } | null {
  const raw = getCookie(ACCESS_COOKIE);
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts as [string, string, string];
  const expected = createHmac("sha256", jwtSecret())
    .update(`${header}.${body}`)
    .digest("base64url");
  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(sig);
  if (expectedBuf.length !== sigBuf.length || !timingSafeEqual(expectedBuf, sigBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as {
      uid: number;
      exp: number;
    };
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) return null;
    return { uid: Number(payload.uid) };
  } catch {
    return null;
  }
}

// ─── User loading ──────────────────────────────────────────────────────────────
export type SessionUser = User;

export async function loadUser(uid: number): Promise<SessionUser | null> {
  return withDb(async (c) => {
    type DbUser = User & { is_active?: number };
    const r = await rows<DbUser>(
      c,
      `SELECT u.user_id,u.name,u.email,u.phone,
        CASE
          WHEN EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.user_id AND r.role='admin') THEN 'admin'
          WHEN EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.user_id AND r.role='staff') THEN 'staff'
          ELSE 'customer'
        END AS role
       FROM users u WHERE u.user_id=?`,
      [uid],
    );
    if (!r[0]) return null;
    const { is_active: _active, ...user } = r[0];
    return user as User;
  });
}

export async function currentUser(): Promise<SessionUser | null> {
  // Try JWT first
  const jwt = verifyAccessToken();
  if (jwt) return loadUser(jwt.uid);
  // Fall back to HMAC session
  const uid = sessionUserId();
  if (!uid) return null;
  return loadUser(uid);
}

// ─── Auth guards ───────────────────────────────────────────────────────────────
export async function requireAuth(): Promise<{ uid: number; role: Role }> {
  const jwt = verifyAccessToken();
  if (jwt) {
    const u = await loadUser(jwt.uid);
    if (u) return { uid: u.user_id, role: u.role };
  }
  const uid = sessionUserId();
  if (uid) {
    const u = await loadUser(uid);
    if (u) return { uid: u.user_id, role: u.role };
  }
  throw Object.assign(new Error("Unauthorized"), { status: 401 });
}

export async function requireRole(
  ...roles: Role[]
): Promise<{ uid: number; role: Role }> {
  const auth = await requireAuth();
  if (!roles.includes(auth.role)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return auth;
}

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new Error("Please sign in first.");
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "admin") throw new Error("Admins only.");
  return u;
}
