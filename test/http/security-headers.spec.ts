import { beforeAll, describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY, HSTS_VALUE } from "../../src/middleware/security";
import { EMAILS } from "../../src/ids";
import { login, seedSql, workerFetch } from "../helpers";

function expectCommonSecurityHeaders(res: Response, referrer = "strict-origin-when-cross-origin") {
  expect(res.headers.get("Content-Security-Policy")).toBe(CONTENT_SECURITY_POLICY);
  expect(res.headers.get("Content-Security-Policy")).toMatch(/frame-ancestors 'none'/);
  expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(res.headers.get("Referrer-Policy")).toBe(referrer);
}

describe("security headers", () => {
  beforeAll(async () => {
    await seedSql();
  });

  it("adds CSP, frame denial, nosniff, referrer policy, and HSTS on https", async () => {
    const res = await workerFetch("https://crm.test/health");
    expect(res.status).toBe(200);
    expectCommonSecurityHeaders(res);
    expect(res.headers.get("Strict-Transport-Security")).toBe(HSTS_VALUE);
  });

  it("omits HSTS on http", async () => {
    const res = await workerFetch("http://crm.test/health");
    expect(res.status).toBe(200);
    expectCommonSecurityHeaders(res);
    expect(res.headers.get("Strict-Transport-Security")).toBeNull();
  });

  it("applies headers to HTML, JSON errors, and 404s", async () => {
    const loginPage = await workerFetch("https://crm.test/login");
    expect(loginPage.status).toBe(200);
    expectCommonSecurityHeaders(loginPage);

    const denied = await workerFetch("https://crm.test/api/me", {
      headers: { Accept: "application/json" },
    });
    expect(denied.status).toBe(401);
    expectCommonSecurityHeaders(denied);

    const missing = await workerFetch("https://crm.test/this-page-does-not-exist");
    expect(missing.status).toBe(404);
    expectCommonSecurityHeaders(missing);
  });

  it("sets no-referrer on the magic-link confirm flow", async () => {
    const res = await workerFetch("https://crm.test/auth/magic?token=deadbeef", {
      redirect: "manual",
    });
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    expectCommonSecurityHeaders(res, "no-referrer");
  });

  it("keeps headers on authenticated pages", async () => {
    const adam = await login(EMAILS.adam);
    const page = await workerFetch("https://crm.test/admin", {
      headers: { Cookie: adam.cookie },
    });
    expect(page.status).toBe(200);
    expectCommonSecurityHeaders(page);
    expect(page.headers.get("Strict-Transport-Security")).toBe(HSTS_VALUE);
  });
});
