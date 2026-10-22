import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import {
  MAGIC_EMAIL_LIMIT,
  MAGIC_RATE_WINDOW_MS,
  consumeRateLimit,
  magicEmailBucket,
  seedRateLimitEvents,
} from "../../src/auth/rate-limit";
import { seedSql } from "../helpers";

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
  });

  it("ignores events older than the sliding window", async () => {
    const bucket = await magicEmailBucket(`stale.${crypto.randomUUID()}@example.test`);
    const stale = new Date(Date.now() - MAGIC_RATE_WINDOW_MS - 1000);
    await seedRateLimitEvents(env.DB, bucket, MAGIC_EMAIL_LIMIT, stale);
    expect(await consumeRateLimit(env.DB, bucket, MAGIC_EMAIL_LIMIT, MAGIC_RATE_WINDOW_MS)).toBe(true);
  });
});
