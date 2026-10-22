import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { isForbiddenSocialField } from "../../src/domain/social";
import { CUSTOMER_IDS } from "../../src/ids";
import { seedSql } from "../helpers";

describe("schema and social storage", () => {
  beforeAll(async () => {
    await seedSql();
  });

  it("has the foundation tables", async () => {
    const tables = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    ).all<{ name: string }>();
    const names = tables.results.map((row) => row.name);
    for (const required of [
      "customers",
      "packages",
      "subscriptions",
      "payments",
      "websites",
      "website_templates",
      "social_accounts",
      "gbp_profiles",
      "seo_snapshots",
      "call_logs",
      "review_items",
      "messages",
      "flags",
      "tickets",
      "ticket_history",
      "users",
      "sessions",
      "magic_links",
      "rate_limit_events",
    ]) {
      expect(names).toContain(required);
    }
  });

  it("allows only one subscription per customer", async () => {
    const indexes = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_subscriptions_one_per_customer'",
    ).all<{ name: string }>();
    expect(indexes.results.map((row) => row.name)).toContain("idx_subscriptions_one_per_customer");
  });

  it("does not store social passwords in normal columns", async () => {
    const cols = await env.DB.prepare("PRAGMA table_info(social_accounts)").all<{ name: string }>();
    const names = cols.results.map((row) => row.name);
    for (const name of names) {
      expect(isForbiddenSocialField(name)).toBe(false);
    }
    expect(names).toContain("access_status");
    expect(names).toContain("owner_email");
    expect(names).toContain("secrets_manager_ref");
    expect(names).not.toContain("password");
  });

  it("rejects a secrets_manager_ref that is not a vault pointer", async () => {
    await expect(
      env.DB.prepare(
        `INSERT INTO social_accounts (id, customer_id, platform, access_status, owner_email, last_verified_at, secrets_manager_ref, notes)
         VALUES (?, ?, 'x', 'none', NULL, NULL, ?, NULL)`,
      )
        .bind(crypto.randomUUID(), CUSTOMER_IDS.lakeview, "plaintext-password")
        .run(),
    ).rejects.toThrow();
  });

  it("seeds only fictional emails", async () => {
    const users = await env.DB.prepare("SELECT email FROM users").all<{ email: string }>();
    for (const row of users.results) {
      expect(row.email.endsWith(".example") || row.email.endsWith(".test")).toBe(true);
    }
  });
});
