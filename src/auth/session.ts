import { sha256Hex, randomToken, nowIso, daysFromNowIso } from "./crypto";
import type { Actor } from "../domain/authz";

/** HTTPS / production name. Requires Secure + Path=/ and forbids Domain. */
export const HOST_SESSION_COOKIE = "__Host-pv_session";
/**
 * HTTP fallback for local `wrangler dev` (http://127.0.0.1). `__Host-` cookies
 * cannot be set without the Secure flag, which browsers drop on http://.
 */
export const DEV_SESSION_COOKIE = "pv_session";
const SESSION_DAYS = 14;
const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

export type SessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  csrf_token: string;
  expires_at: string;
};

export function isHttpsRequest(requestUrl: string): boolean {
  return new URL(requestUrl).protocol === "https:";
}

export function sessionCookieName(requestUrl: string): string {
  return isHttpsRequest(requestUrl) ? HOST_SESSION_COOKIE : DEV_SESSION_COOKIE;
}

export async function createSession(
  db: D1Database,
  userId: string,
): Promise<{ rawToken: string; csrfToken: string; expiresAt: string; sessionId: string }> {
  const sessionId = crypto.randomUUID();
  const rawToken = randomToken();
  const tokenHash = await sha256Hex(rawToken);
  const csrfToken = randomToken();
  const expiresAt = daysFromNowIso(SESSION_DAYS);
  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, token_hash, csrf_token, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(sessionId, userId, tokenHash, csrfToken, expiresAt, nowIso())
    .run();
  return { rawToken, csrfToken, expiresAt, sessionId };
}

export async function loadActorFromCookie(
  db: D1Database,
  cookieHeader: string | null,
): Promise<{ actor: Actor; csrfToken: string; sessionId: string } | null> {
  const raw = readCookie(cookieHeader, HOST_SESSION_COOKIE) ?? readCookie(cookieHeader, DEV_SESSION_COOKIE);
  if (!raw) {
    return null;
  }
  const tokenHash = await sha256Hex(raw);
  const row = await db
    .prepare(
      `SELECT s.id AS session_id, s.csrf_token, s.expires_at,
              u.id, u.email, u.display_name, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND u.role = 'admin'`,
    )
    .bind(tokenHash)
    .first<{
      session_id: string;
      csrf_token: string;
      expires_at: string;
      id: string;
      email: string;
      display_name: string;
      role: Actor["role"];
    }>();

  if (!row) {
    return null;
  }
  if (row.expires_at <= nowIso()) {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(row.session_id).run();
    return null;
  }

  return {
    sessionId: row.session_id,
    csrfToken: row.csrf_token,
    actor: {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
    },
  };
}

export async function destroySession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

export function sessionCookie(rawToken: string, requestUrl: string): string {
  const https = isHttpsRequest(requestUrl);
  return formatSessionCookie(sessionCookieName(requestUrl), rawToken, SESSION_MAX_AGE, https);
}

export function clearSessionCookie(requestUrl: string): string {
  const https = isHttpsRequest(requestUrl);
  return formatSessionCookie(sessionCookieName(requestUrl), "", 0, https);
}

/** Clear both names so an HTTP leftover cannot outlive an HTTPS login. */
export function clearSessionCookies(): string[] {
  return [
    formatSessionCookie(DEV_SESSION_COOKIE, "", 0, false),
    formatSessionCookie(HOST_SESSION_COOKIE, "", 0, true),
  ];
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return rest.join("=");
    }
  }
  return null;
}

function formatSessionCookie(name: string, value: string, maxAge: number, secure: boolean): string {
  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}
