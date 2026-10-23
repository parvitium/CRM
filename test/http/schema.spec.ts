import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { PLANS } from "../../src/config/plans";
import { isForbiddenSocialField } from "../../src/domain/social";
import { CUSTOMER_IDS } from "../../src/ids";
import { seedSql } from "../helpers";

describe("schema and social storage", () => {
  beforeAll(async () => {
    await seedSql();
  });

  it("has the foundation tables and not the removed portal/auth tables", async () => {
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
    ]) {
      expect(names).toContain(required);
    }
    expect(names).not.toContain("magic_links");
    expect(names).not.toContain("rate_limit_events");
  });

  it("seeds packages from the canonical plan catalog", async () => {
    const rows = await env.DB.prepare(
      "SELECT id, product_line, name, slug, setup_price_cents, monthly_price_cents, description, sort_order FROM packages ORDER BY sort_order",
    ).all<{
      id: string;
      product_line: string;
      name: string;
      slug: string;
      setup_price_cents: number;
      monthly_price_cents: number;
      description: string;
      sort_order: number;
    }>();
    expect(rows.results).toEqual(
      PLANS.map((plan) => ({
        id: plan.id,
        product_line: plan.productLine,
        name: plan.name,
        slug: plan.slug,
        setup_price_cents: plan.setupPriceCents,
        monthly_price_cents: plan.monthlyPriceCents,
        description: plan.description,
        sort_order: plan.sortOrder,
      })),
    );
  });

  it("classifies customers as Parvitium, TooeleTrades, or both", async () => {
    const cols = await env.DB.prepare("PRAGMA table_info(customers)").all<{ name: string }>();
    expect(cols.results.map((row) => row.name)).toContain("kind");
    const kinds = await env.DB.prepare("SELECT kind FROM customers GROUP BY kind").all<{
      kind: string;
    }>();
    expect(kinds.results.map((row) => row.kind).sort()).toEqual(["both", "parvitium", "tooele_trades"]);
  });

  it("allows one row per package per customer, including both product lines", async () => {
    const indexes = await env.DB.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'subscriptions'",
    ).first<{ sql: string }>();
    expect(indexes?.sql).toMatch(/UNIQUE\s*\(\s*customer_id\s*,\s*package_id\s*\)/);
    const summit = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM subscriptions WHERE customer_id = ?",
    )
      .bind(CUSTOMER_IDS.summit)
      .first<{ n: number }>();
    expect(summit?.n).toBe(2);
  });

  it("keeps users admin-only", async () => {
    const cols = await env.DB.prepare("PRAGMA table_info(users)").all<{ name: string }>();
    expect(cols.results.map((row) => row.name)).not.toContain("customer_id");
    const roles = await env.DB.prepare("SELECT DISTINCT role FROM users").all<{ role: string }>();
    expect(roles.results.map((row) => row.role)).toEqual(["admin"]);
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

  it("rejects a secrets_manager_ref that is not an op:// pointer", async () => {
    await expect(
      env.DB.prepare(
        `INSERT INTO social_accounts (id, customer_id, platform, access_status, owner_email, last_verified_at, secrets_manager_ref, notes)
         VALUES (?, ?, 'x', 'none', NULL, NULL, ?, NULL)`,
      )
        .bind(crypto.randomUUID(), CUSTOMER_IDS.lakeview, "plaintext-password")
        .run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        `INSERT INTO social_accounts (id, customer_id, platform, access_status, owner_email, last_verified_at, secrets_manager_ref, notes)
         VALUES (?, ?, 'x', 'none', NULL, NULL, ?, NULL)`,
      )
        .bind(crypto.randomUUID(), CUSTOMER_IDS.lakeview, "vault://prod/secret")
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
