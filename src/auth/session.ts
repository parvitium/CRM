import { sha256Hex, randomToken, nowIso, daysFromNowIso } from "./crypto";
import type { Actor } from "../domain/authz";

const COOKIE = "pv_session";
const SESSION_DAYS = 14;

export type SessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  csrf_token: string;
  expires_at: string;
};

export async function createSession(
  db: D1Database,
  userId: string,
): Promise<{ rawToken: string; csrfToken: string; expiresAt: string }> {
  const rawToken = randomToken();
  const tokenHash = await sha256Hex(rawToken);
  const csrfToken = randomToken();
  const expiresAt = daysFromNowIso(SESSION_DAYS);
  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, token_hash, csrf_token, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), userId, tokenHash, csrfToken, expiresAt, nowIso())
    .run();
  return { rawToken, csrfToken, expiresAt };
}

export async function loadActorFromCookie(
  db: D1Database,
  cookieHeader: string | null,
): Promise<{ actor: Actor; csrfToken: string; sessionId: string } | null> {
  const raw = readCookie(cookieHeader, COOKIE);
  if (!raw) {
    return null;
  }
  const tokenHash = await sha256Hex(raw);
  const row = await db
    .prepare(
      `SELECT s.id AS session_id, s.csrf_token, s.expires_at,
              u.id, u.email, u.display_name, u.role, u.customer_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
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
      customer_id: string | null;
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
      customerId: row.customer_id,
    },
  };
}

export async function destroySession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

export function sessionCookie(rawToken: string, requestUrl: string): string {
  const secure = new URL(requestUrl).protocol === "https:";
  const parts = [
    `${COOKIE}=${rawToken}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_DAYS * 24 * 60 * 60}`,
  ];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function clearSessionCookie(requestUrl: string): string {
  const secure = new URL(requestUrl).protocol === "https:";
  const parts = [`${COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
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
