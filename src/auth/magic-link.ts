import { hoursFromNowIso, nowIso, randomToken, sha256Hex } from "./crypto";
import { readCookie } from "./session";
import type { EmailAdapter } from "../adapters/types";

const TTL_HOURS = 0.25; // 15 minutes
export const MAGIC_CSRF_COOKIE = "pv_magic_csrf";
export const MAGIC_TOKEN_COOKIE = "pv_magic_token";
const MAGIC_CSRF_MAX_AGE = 15 * 60;
/** Floor so known and unknown emails spend the same time issuing a link. */
export const MAGIC_ISSUE_MIN_MS = 50;

export async function issueMagicLink(
  db: D1Database,
  emailAdapter: EmailAdapter,
  email: string,
  origin: string,
): Promise<void> {
  const started = Date.now();
  const normalized = email.trim().toLowerCase();
  const user = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(normalized)
    .first<{ id: string }>();
  // Always generate and hash so existence is not a crypto-timing oracle.
  const raw = randomToken();
  const tokenHash = await sha256Hex(raw);

  if (user) {
    await db
      .prepare(
        `INSERT INTO magic_links (id, email, token_hash, expires_at, used_at, created_at)
         VALUES (?, ?, ?, ?, NULL, ?)`,
      )
      .bind(crypto.randomUUID(), normalized, tokenHash, hoursFromNowIso(TTL_HOURS), nowIso())
      .run();

    const url = `${origin}/auth/magic?token=${raw}`;
    await emailAdapter.sendMagicLink(normalized, url);
  } else {
    // Same shape of work: D1 round-trips + extra hash. Never persist a usable link
    // or write outbound mail for an unknown address.
    await burnUnknownIssueWork(db, normalized, tokenHash);
  }

  await padElapsed(started, MAGIC_ISSUE_MIN_MS);
}

export async function burnUnknownIssueWork(
  db: D1Database,
  email: string,
  tokenHash: string,
): Promise<void> {
  await db
    .prepare("SELECT id FROM magic_links WHERE token_hash = ? AND email = ? LIMIT 1")
    .bind(tokenHash, email)
    .first();
  await db
    .prepare("SELECT id FROM outbound_emails WHERE to_email = ? LIMIT 1")
    .bind(email)
    .first();
  await sha256Hex(tokenHash);
}

export async function padElapsed(startedMs: number, minMs: number): Promise<void> {
  const remain = minMs - (Date.now() - startedMs);
  if (remain > 0) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, remain);
    });
  }
}

/** Look up a token without consuming it. Used by the GET confirm page. */
export async function peekMagicLink(
  db: D1Database,
  rawToken: string,
): Promise<"ok" | "invalid"> {
  const tokenHash = await hashToken(rawToken);
  if (!tokenHash) {
    return "invalid";
  }
  const row = await db
    .prepare(`SELECT expires_at, used_at FROM magic_links WHERE token_hash = ?`)
    .bind(tokenHash)
    .first<{ expires_at: string; used_at: string | null }>();
  if (!row || row.used_at || row.expires_at <= nowIso()) {
    return "invalid";
  }
  return "ok";
}

/**
 * Single-use consume. The UPDATE is atomic: only one caller can set used_at
 * when it is still NULL and unexpired.
 */
export async function consumeMagicLink(db: D1Database, rawToken: string): Promise<string | null> {
  const tokenHash = await hashToken(rawToken);
  if (!tokenHash) {
    return null;
  }
  const now = nowIso();
  const updated = await db
    .prepare(
      `UPDATE magic_links
       SET used_at = ?
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`,
    )
    .bind(now, tokenHash, now)
    .run();
  if (!updated.success || Number(updated.meta.changes ?? 0) !== 1) {
    return null;
  }

  const row = await db
    .prepare("SELECT email FROM magic_links WHERE token_hash = ?")
    .bind(tokenHash)
    .first<{ email: string }>();
  if (!row) {
    return null;
  }
  const user = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(row.email)
    .first<{ id: string }>();
  return user?.id ?? null;
}

export function createMagicCsrf(): string {
  return randomToken();
}

export function magicCsrfCookie(rawToken: string, requestUrl: string): string {
  return formatMagicCookie(MAGIC_CSRF_COOKIE, rawToken, requestUrl, MAGIC_CSRF_MAX_AGE);
}

export function clearMagicCsrfCookie(requestUrl: string): string {
  return formatMagicCookie(MAGIC_CSRF_COOKIE, "", requestUrl, 0);
}

export function readMagicCsrf(cookieHeader: string | null): string | null {
  return readCookie(cookieHeader, MAGIC_CSRF_COOKIE);
}

export function magicTokenCookie(rawToken: string, requestUrl: string): string {
  return formatMagicCookie(MAGIC_TOKEN_COOKIE, rawToken, requestUrl, MAGIC_CSRF_MAX_AGE);
}

export function clearMagicTokenCookie(requestUrl: string): string {
  return formatMagicCookie(MAGIC_TOKEN_COOKIE, "", requestUrl, 0);
}

export function readMagicToken(cookieHeader: string | null): string | null {
  return readCookie(cookieHeader, MAGIC_TOKEN_COOKIE);
}

async function hashToken(rawToken: string): Promise<string | null> {
  const trimmed = rawToken.trim();
  if (!trimmed) {
    return null;
  }
  return sha256Hex(trimmed);
}

function formatMagicCookie(name: string, value: string, requestUrl: string, maxAge: number): string {
  const secure = new URL(requestUrl).protocol === "https:";
  const parts = [
    `${name}=${value}`,
    "Path=/auth/magic",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}
