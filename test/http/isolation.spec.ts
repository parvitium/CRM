import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { listPortalSocialAccounts, listSocialAccounts, PORTAL_SOCIAL_COLUMNS } from "../../src/db/queries";
import { CUSTOMER_IDS, EMAILS } from "../../src/ids";
import { json, login, seedSql, workerFetch } from "../helpers";

describe("customer isolation", () => {
  beforeAll(async () => {
    await seedSql();
  });

  it("lets a portal user see only their own overview", async () => {
    const summit = await login(EMAILS.summit);
    const own = await json<{ customer: { id: string; business_name: string } }>(
      "/api/portal/overview",
      { cookie: summit.cookie },
    );
    expect(own.status).toBe(200);
    expect(own.body.customer.id).toBe(CUSTOMER_IDS.summit);
    expect(own.body.customer.business_name).toContain("Summit Ridge");

    const other = await json<{ error?: string }>(
      `/api/portal/customers/${CUSTOMER_IDS.copper}`,
      { cookie: summit.cookie },
    );
    expect(other.status).toBe(403);
    expect(other.body.error).toMatch(/another customer/i);
  });

  it("blocks a customer from reading another customer by admin API id", async () => {
    const summit = await login(EMAILS.summit);
    const res = await json<{ error?: string }>(`/api/admin/customers/${CUSTOMER_IDS.copper}`, {
      cookie: summit.cookie,
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin/i);
  });

  it("does not show vault pointers on the portal social page", async () => {
    const summit = await login(EMAILS.summit);
    const page = await workerFetch("https://crm.test/portal/social", {
      headers: { Cookie: summit.cookie },
    });
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain("facebook");
    expect(html).toContain("partner_granted");
    expect(html).not.toContain("op://");
    expect(html).not.toContain("password");
  });

  it("never selects secrets_manager_ref in the portal social query", async () => {
    expect(PORTAL_SOCIAL_COLUMNS).not.toContain("secrets_manager_ref");
    const portal = await listPortalSocialAccounts(env.DB, CUSTOMER_IDS.summit);
    const admin = await listSocialAccounts(env.DB, CUSTOMER_IDS.summit);
    expect(portal.results.length).toBeGreaterThan(0);
    expect(admin.results.some((row) => String(row.secrets_manager_ref ?? "").startsWith("op://"))).toBe(
      true,
    );
    for (const row of portal.results) {
      expect(row).not.toHaveProperty("secrets_manager_ref");
    }
    expect(JSON.stringify(portal.results)).not.toContain("op://");
    expect(JSON.stringify(portal.results)).not.toContain("secrets_manager_ref");
  });

  it("keeps admin HTML and APIs off-limits to customers", async () => {
    const summit = await login(EMAILS.summit);
    const api = await json<{ error?: string }>("/api/admin/customers", {
      cookie: summit.cookie,
    });
    expect(api.status).toBe(403);

    const page = await workerFetch("https://crm.test/admin/customers", {
      headers: { Cookie: summit.cookie },
      redirect: "manual",
    });
    expect(page.status).toBe(403);
    const html = await page.text();
    expect(html).not.toContain("Copper Peak Plumbing");
  });

  it("does not leak another customer's HTML through the portal", async () => {
    const summit = await login(EMAILS.summit);
    const page = await workerFetch("https://crm.test/portal/package", {
      headers: { Cookie: summit.cookie },
    });
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain("Starter");
    expect(html).not.toContain("Copper Peak");
    expect(html).not.toContain("cus_mock_copper");
    expect(html).not.toContain("Job Pages");
  });

  it("lets admin see every customer", async () => {
    const adam = await login(EMAILS.adam);
    const list = await json<{ customers: { business_name: string }[] }>("/api/admin/customers", {
      cookie: adam.cookie,
    });
    expect(list.status).toBe(200);
    const names = list.body.customers.map((row) => row.business_name);
    expect(names).toContain("Summit Ridge Roofing LLC");
    expect(names).toContain("Copper Peak Plumbing LLC");
  });

  it("rejects anonymous access to portal and admin APIs", async () => {
    const portal = await json<{ error?: string }>("/api/portal/overview");
    const admin = await json<{ error?: string }>("/api/admin/tickets");
    expect(portal.status).toBe(401);
    expect(admin.status).toBe(401);
  });
});
