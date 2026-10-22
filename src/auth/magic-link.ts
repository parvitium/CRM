import { hoursFromNowIso, nowIso, randomToken, sha256Hex } from "./crypto";
import type { EmailAdapter } from "../adapters/types";

const TTL_HOURS = 0.25; // 15 minutes

export async function issueMagicLink(
  db: D1Database,
  emailAdapter: EmailAdapter,
  email: string,
  origin: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const user = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(normalized)
    .first<{ id: string }>();
  // Always behave the same to the caller. Do not reveal whether the email exists.
  if (!user) {
    return;
  }

  const raw = randomToken();
  const tokenHash = await sha256Hex(raw);
  await db
    .prepare(
      `INSERT INTO magic_links (id, email, token_hash, expires_at, used_at, created_at)
       VALUES (?, ?, ?, ?, NULL, ?)`,
    )
    .bind(crypto.randomUUID(), normalized, tokenHash, hoursFromNowIso(TTL_HOURS), nowIso())
    .run();

  const url = `${origin}/auth/magic?token=${raw}`;
  await emailAdapter.sendMagicLink(normalized, url);
}

export async function consumeMagicLink(db: D1Database, rawToken: string): Promise<string | null> {
  const tokenHash = await sha256Hex(rawToken);
  const row = await db
    .prepare(
      `SELECT id, email, expires_at, used_at FROM magic_links WHERE token_hash = ?`,
    )
    .bind(tokenHash)
    .first<{ id: string; email: string; expires_at: string; used_at: string | null }>();

  if (!row || row.used_at || row.expires_at <= nowIso()) {
    return null;
  }

  await db
    .prepare("UPDATE magic_links SET used_at = ? WHERE id = ?")
    .bind(nowIso(), row.id)
    .run();

  const user = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(row.email)
    .first<{ id: string }>();
  return user?.id ?? null;
}
