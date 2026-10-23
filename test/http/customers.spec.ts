import { beforeAll, describe, expect, it } from "vitest";
import { PACKAGE_IDS, EMAILS } from "../../src/ids";
import { hiddenInput, json, login, seedSql, workerFetch } from "../helpers";

describe("admin customers", () => {
  beforeAll(async () => {
    await seedSql();
  });

  it("creates a TooeleTrades listing with a catalog package", async () => {
    const adam = await login(EMAILS.adam);
    const page = await workerFetch("https://crm.test/admin/customers", {
      headers: { Cookie: adam.cookie },
    });
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain("TooeleTrades");
    expect(html).toContain("$29.00/mo");
    expect(hiddenInput(html, "csrf")).toBe(adam.csrf);

    const res = await workerFetch("https://crm.test/admin/customers", {
      method: "POST",
      headers: {
        Cookie: adam.cookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        csrf: adam.csrf,
        kind: "tooele_trades",
        business_name: "Mock HVAC LLC",
        contact_name: "Pat Example",
        contact_email: "pat@mockhvac.example",
        city: "Tooele",
        package_id: PACKAGE_IDS.ttPro,
      }).toString(),
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    const location = res.headers.get("Location") ?? "";
    expect(location).toMatch(/\/admin\/customers\/[0-9a-f-]+/);

    const id = location.split("/admin/customers/")[1]?.split("?")[0] ?? "";
    const detail = await json<{ customer: { kind: string; business_name: string } }>(
      `/api/admin/customers/${id}`,
      { cookie: adam.cookie },
    );
    expect(detail.status).toBe(200);
    expect(detail.body.customer.kind).toBe("tooele_trades");
    expect(detail.body.customer.business_name).toBe("Mock HVAC LLC");
  });

  it("rejects a customer without a kind", async () => {
    const adam = await login(EMAILS.adam);
    const res = await workerFetch("https://crm.test/admin/customers", {
      method: "POST",
      headers: {
        Cookie: adam.cookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        csrf: adam.csrf,
        business_name: "No Kind LLC",
        contact_name: "Pat Example",
        contact_email: "nokind@example.test",
      }).toString(),
      redirect: "manual",
    });
    expect(res.status).toBe(400);
  });
});
