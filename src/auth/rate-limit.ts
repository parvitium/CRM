import { sha256Hex } from "./crypto";

export const MAGIC_EMAIL_LIMIT = 5;
export const MAGIC_IP_LIMIT = 20;
export const MAGIC_RATE_WINDOW_MS = 15 * 60 * 1000;

export function clientIp(request: Request): string {
  const cf = request.headers.get("CF-Connecting-IP")?.trim();
  if (cf) {
    return cf;
  }
  const forwarded = request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim();
  if (forwarded) {
    return forwarded;
  }
  return "unknown";
}

export async function magicEmailBucket(email: string): Promise<string> {
  return `magic-email:${await sha256Hex(email.trim().toLowerCase())}`;
}

export async function magicIpBucket(ip: string): Promise<string> {
  return `magic-ip:${await sha256Hex(ip.trim() || "unknown")}`;
}

/**
 * Sliding-window counter in D1. Inserts this attempt, then allows it when the
 * number of events in the window is still at or under `limit`.
 */
export async function consumeRateLimit(
  db: D1Database,
  bucket: string,
  limit: number,
  windowMs: number,
  nowMs = Date.now(),
): Promise<boolean> {
  const cutoff = new Date(nowMs - windowMs).toISOString();
  const ts = new Date(nowMs).toISOString();
  const results = await db.batch([
    db.prepare("DELETE FROM rate_limit_events WHERE bucket = ? AND created_at < ?").bind(bucket, cutoff),
    db
      .prepare("INSERT INTO rate_limit_events (id, bucket, created_at) VALUES (?, ?, ?)")
      .bind(crypto.randomUUID(), bucket, ts),
    db
      .prepare("SELECT COUNT(*) AS n FROM rate_limit_events WHERE bucket = ? AND created_at >= ?")
      .bind(bucket, cutoff),
  ]);
  const countRow = results[2]?.results?.[0] as { n: number } | undefined;
  return Number(countRow?.n ?? 0) <= limit;
}

/** Always consume both buckets so the path does not depend on whether the email exists. */
export async function allowMagicLinkIssue(db: D1Database, email: string, ip: string): Promise<boolean> {
  const [emailBucket, ipBucket] = await Promise.all([magicEmailBucket(email), magicIpBucket(ip)]);
  const emailOk = await consumeRateLimit(db, emailBucket, MAGIC_EMAIL_LIMIT, MAGIC_RATE_WINDOW_MS);
  const ipOk = await consumeRateLimit(db, ipBucket, MAGIC_IP_LIMIT, MAGIC_RATE_WINDOW_MS);
  return emailOk && ipOk;
}

export async function seedRateLimitEvents(
  db: D1Database,
  bucket: string,
  count: number,
  at = new Date(),
): Promise<void> {
  if (count <= 0) {
    return;
  }
  const ts = at.toISOString();
  const statements = Array.from({ length: count }, () =>
    db
      .prepare("INSERT INTO rate_limit_events (id, bucket, created_at) VALUES (?, ?, ?)")
      .bind(crypto.randomUUID(), bucket, ts),
  );
  await db.batch(statements);
}
