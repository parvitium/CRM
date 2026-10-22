import { sha256Hex } from "./crypto";
import { isHttpsRequest } from "./session";

export const MAGIC_EMAIL_LIMIT = 5;
export const MAGIC_IP_LIMIT = 20;
export const MAGIC_RATE_WINDOW_MS = 15 * 60 * 1000;
/** ~1/16 of consume calls also sweep expired rows from every bucket. */
export const RATE_LIMIT_SWEEP_CHANCE = 1 / 16;
export const RATE_LIMIT_SWEEP_BATCH = 100;

export function clientIp(request: Request): string {
  const cf = request.headers.get("CF-Connecting-IP")?.trim();
  if (cf) {
    return cf;
  }
  // X-Forwarded-For is client-spoofable. Cloudflare always sets CF-Connecting-IP
  // in production; only local HTTP wrangler dev needs the XFF fallback.
  if (!isHttpsRequest(request.url)) {
    const forwarded = request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim();
    if (forwarded) {
      return forwarded;
    }
  }
  return "unknown";
}

export async function magicEmailBucket(email: string): Promise<string> {
  return `magic-email:${await sha256Hex(email.trim().toLowerCase())}`;
}

export async function magicIpBucket(ip: string): Promise<string> {
  return `magic-ip:${await sha256Hex(ip.trim() || "unknown")}`;
}

export type ConsumeRateLimitOptions = {
  sweepChance?: number;
};

/**
 * Sliding-window counter in D1. Inserts this attempt only when the bucket is
 * still under `limit`. The INSERT … SELECT is one statement so concurrent
 * writers cannot push the in-window count past `limit`.
 */
export async function consumeRateLimit(
  db: D1Database,
  bucket: string,
  limit: number,
  windowMs: number,
  nowMs = Date.now(),
  options: ConsumeRateLimitOptions = {},
): Promise<boolean> {
  const sweepChance = options.sweepChance ?? RATE_LIMIT_SWEEP_CHANCE;
  if (sweepChance > 0 && (sweepChance >= 1 || Math.random() < sweepChance)) {
    await sweepExpiredRateLimitEvents(db, nowMs, RATE_LIMIT_SWEEP_BATCH, windowMs);
  }

  const cutoff = new Date(nowMs - windowMs).toISOString();
  const ts = new Date(nowMs).toISOString();
  const row = await db
    .prepare(
      `INSERT INTO rate_limit_events (id, bucket, created_at)
       SELECT ?, ?, ?
       WHERE (
         SELECT COUNT(*) FROM rate_limit_events
         WHERE bucket = ? AND created_at >= ?
       ) < ?
       RETURNING id`,
    )
    .bind(crypto.randomUUID(), bucket, ts, bucket, cutoff, limit)
    .first<{ id: string }>();
  return Boolean(row);
}

/** Delete expired events across every bucket, oldest first, capped per call. */
export async function sweepExpiredRateLimitEvents(
  db: D1Database,
  nowMs = Date.now(),
  limit = RATE_LIMIT_SWEEP_BATCH,
  windowMs = MAGIC_RATE_WINDOW_MS,
): Promise<number> {
  const cutoff = new Date(nowMs - windowMs).toISOString();
  const result = await db
    .prepare(
      `DELETE FROM rate_limit_events WHERE id IN (
         SELECT id FROM rate_limit_events
         WHERE created_at < ?
         ORDER BY created_at
         LIMIT ?
       )`,
    )
    .bind(cutoff, limit)
    .run();
  return Number(result.meta.changes ?? 0);
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
