import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { listSocialAccounts } from "../../src/db/queries";
import { CUSTOMER_IDS, EMAILS } from "../../src/ids";
import { json, login, seedSql, workerFetch } from "../helpers";

describe("admin-only access", () => {
  beforeAll(async () => {
    await seedSql();
  });

  it("has no customer portal routes", async () => {
    const adam = await login(EMAILS.adam);
    for (const path of ["/portal", "/portal/package", "/api/portal/overview"]) {
      const res = await workerFetch(`https://crm.test${path}`, {
        headers: { Cookie: adam.cookie, Accept: "application/json" },
        redirect: "manual",
      });
      expect(res.status).toBe(404);
    }
  });

  it("lets admin see Parvitium clients and TooeleTrades listings", async () => {
    const adam = await login(EMAILS.adam);
    const list = await json<{
      customers: { business_name: string; kind: string }[];
    }>("/api/admin/customers", { cookie: adam.cookie });
    expect(list.status).toBe(200);
    const names = list.body.customers.map((row) => row.business_name);
    expect(names).toContain("Summit Ridge Roofing LLC");
    expect(names).toContain("Copper Peak Plumbing LLC");
    expect(names).toContain("Desert Sage Landscaping LLC");
    expect(names).toContain("Wasatch Fence Co.");
    const kinds = new Set(list.body.customers.map((row) => row.kind));
    expect(kinds.has("parvitium")).toBe(true);
    expect(kinds.has("tooele_trades")).toBe(true);
    expect(kinds.has("both")).toBe(true);

    const listings = await json<{ customers: { business_name: string }[] }>(
      "/api/admin/customers?kind=tooele_trades",
      { cookie: adam.cookie },
    );
    const listingNames = listings.body.customers.map((row) => row.business_name);
    expect(listingNames).toContain("Desert Sage Landscaping LLC");
    expect(listingNames).toContain("Wasatch Fence Co.");
    expect(listingNames).toContain("Summit Ridge Roofing LLC");
    expect(listingNames).not.toContain("Copper Peak Plumbing LLC");
  });

  it("shows 1Password pointers only in admin social records, never passwords", async () => {
    const adam = await login(EMAILS.adam);
    const page = await workerFetch(`https://crm.test/admin/customers/${CUSTOMER_IDS.summit}`, {
      headers: { Cookie: adam.cookie },
    });
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain("op://Parvitium/summit-ridge-facebook");
    expect(html).not.toMatch(/type="password"/);
    expect(html).not.toMatch(/name="password"/);
    const admin = await listSocialAccounts(env.DB, CUSTOMER_IDS.summit);
    expect(admin.results.some((row) => String(row.secrets_manager_ref ?? "").startsWith("op://"))).toBe(
      true,
    );
  });

  it("rejects anonymous access to admin APIs", async () => {
    const me = await json<{ error?: string }>("/api/me");
    const admin = await json<{ error?: string }>("/api/admin/tickets");
    expect(me.status).toBe(401);
    expect(admin.status).toBe(401);
  });

  it("rejects a customer-looking email on local dev login", async () => {
    const res = await workerFetch("https://crm.test/auth/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: "portal.summit@example.test" }).toString(),
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toMatch(/Unknown\+dev\+user/);
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });
});
