import { beforeAll, describe, expect, it } from "vitest";
import { env, exports } from "cloudflare:workers";
import {
  MAGIC_EMAIL_LIMIT,
  MAGIC_RATE_WINDOW_MS,
  clientIp,
  consumeRateLimit,
  magicEmailBucket,
  seedRateLimitEvents,
  sweepExpiredRateLimitEvents,
} from "../../src/auth/rate-limit";
import { seedSql } from "../helpers";

async function bucketCount(bucket: string): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM rate_limit_events WHERE bucket = ?")
    .bind(bucket)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

describe("client IP", () => {
  it("uses CF-Connecting-IP on HTTPS and ignores X-Forwarded-For", () => {
    const both = new Request("https://crm.test/auth/magic", {
      headers: {
        "CF-Connecting-IP": "198.51.100.10",
        "X-Forwarded-For": "203.0.113.9, 192.0.2.1",
      },
    });
    expect(clientIp(both)).toBe("198.51.100.10");

    const xffOnly = new Request("https://crm.test/auth/magic", {
      headers: { "X-Forwarded-For": "203.0.113.9" },
    });
    expect(clientIp(xffOnly)).toBe("unknown");
  });

  it("falls back to X-Forwarded-For only on local HTTP", () => {
    const xffOnly = new Request("http://127.0.0.1:8787/auth/magic", {
      headers: { "X-Forwarded-For": "203.0.113.9, 192.0.2.1" },
    });
    expect(clientIp(xffOnly)).toBe("203.0.113.9");

    const cfWins = new Request("http://127.0.0.1:8787/auth/magic", {
      headers: {
        "CF-Connecting-IP": "198.51.100.10",
        "X-Forwarded-For": "203.0.113.9",
      },
    });
    expect(clientIp(cfWins)).toBe("198.51.100.10");
  });
});

describe("magic-link rate limit window", () => {
  beforeAll(async () => {
    await seedSql();
  });

  it("allows up to the limit and denies the next event in the window", async () => {
    const bucket = await magicEmailBucket(`window.${crypto.randomUUID()}@example.test`);
    for (let i = 0; i < MAGIC_EMAIL_LIMIT; i += 1) {
      expect(await consumeRateLimit(env.DB, bucket, MAGIC_EMAIL_LIMIT, MAGIC_RATE_WINDOW_MS)).toBe(true);
    }
    expect(await consumeRateLimit(env.DB, bucket, MAGIC_EMAIL_LIMIT, MAGIC_RATE_WINDOW_MS)).toBe(false);
    expect(await bucketCount(bucket)).toBe(MAGIC_EMAIL_LIMIT);
  });

  it("does not insert a row when the bucket is already at the limit", async () => {
    const bucket = await magicEmailBucket(`deny-grow.${crypto.randomUUID()}@example.test`);
    await seedRateLimitEvents(env.DB, bucket, MAGIC_EMAIL_LIMIT);
    expect(await bucketCount(bucket)).toBe(MAGIC_EMAIL_LIMIT);
    for (let i = 0; i < 10; i += 1) {
      expect(
        await consumeRateLimit(env.DB, bucket, MAGIC_EMAIL_LIMIT, MAGIC_RATE_WINDOW_MS, Date.now(), {
          sweepChance: 0,
        }),
      ).toBe(false);
    }
    expect(await bucketCount(bucket)).toBe(MAGIC_EMAIL_LIMIT);
  });

  it("ignores events older than the sliding window", async () => {
    const bucket = await magicEmailBucket(`stale.${crypto.randomUUID()}@example.test`);
    const stale = new Date(Date.now() - MAGIC_RATE_WINDOW_MS - 1000);
    await seedRateLimitEvents(env.DB, bucket, MAGIC_EMAIL_LIMIT, stale);
    expect(
      await consumeRateLimit(env.DB, bucket, MAGIC_EMAIL_LIMIT, MAGIC_RATE_WINDOW_MS, Date.now(), {
        sweepChance: 0,
      }),
    ).toBe(true);
  });

  it("deletes expired rows from unused buckets", async () => {
    const staleBucket = await magicEmailBucket(`expired.${crypto.randomUUID()}@example.test`);
    const liveBucket = await magicEmailBucket(`live.${crypto.randomUUID()}@example.test`);
    const stale = new Date(Date.now() - MAGIC_RATE_WINDOW_MS - 1000);
    await seedRateLimitEvents(env.DB, staleBucket, 7, stale);
    await seedRateLimitEvents(env.DB, liveBucket, 2);
    expect(await bucketCount(staleBucket)).toBe(7);

    expect(await sweepExpiredRateLimitEvents(env.DB)).toBeGreaterThan(0);
    expect(await bucketCount(staleBucket)).toBe(0);
    expect(await bucketCount(liveBucket)).toBe(2);
  });

  it("sweeps expired rows from other buckets on a consume when chance is 1", async () => {
    const staleBucket = await magicEmailBucket(`opp-stale.${crypto.randomUUID()}@example.test`);
    const liveBucket = await magicEmailBucket(`opp-live.${crypto.randomUUID()}@example.test`);
    const stale = new Date(Date.now() - MAGIC_RATE_WINDOW_MS - 1000);
    await seedRateLimitEvents(env.DB, staleBucket, 4, stale);

    expect(
      await consumeRateLimit(env.DB, liveBucket, MAGIC_EMAIL_LIMIT, MAGIC_RATE_WINDOW_MS, Date.now(), {
        sweepChance: 1,
      }),
    ).toBe(true);
    expect(await bucketCount(staleBucket)).toBe(0);
    expect(await bucketCount(liveBucket)).toBe(1);
  });

  it("scheduled handler deletes expired rate_limit_events", async () => {
    const staleBucket = await magicEmailBucket(`cron-stale.${crypto.randomUUID()}@example.test`);
    const stale = new Date(Date.now() - MAGIC_RATE_WINDOW_MS - 1000);
    await seedRateLimitEvents(env.DB, staleBucket, 3, stale);
    const worker = exports.default as ExportedHandler<Env>;
    expect(worker.scheduled).toBeTypeOf("function");
    await worker.scheduled!(
      { scheduledTime: Date.now(), cron: "*/15 * * * *", noRetry() {} },
      env,
      {} as ExecutionContext,
    );
    expect(await bucketCount(staleBucket)).toBe(0);
  });
});
