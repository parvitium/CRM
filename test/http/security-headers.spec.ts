import { beforeAll, describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY, HSTS_VALUE } from "../../src/middleware/security";
import { EMAILS } from "../../src/ids";
import {
  immutableAssetResponse,
  LOCAL_HTTPS_ORIGIN,
  localUrl,
  login,
  mockAssetsFetcher,
  seedSql,
  workerFetch,
  workerFetchWithEnv,
} from "../helpers";

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

    const denied = await workerFetch(localUrl("/api/me"), {
      headers: { Accept: "application/json" },
    });
    expect(denied.status).toBe(401);
    expectCommonSecurityHeaders(denied);

    const missing = await workerFetch("https://crm.test/this-page-does-not-exist");
    expect(missing.status).toBe(404);
    expectCommonSecurityHeaders(missing);
  });

  it("uses the default referrer policy on HTML pages", async () => {
    const res = await workerFetch("https://crm.test/login", { redirect: "manual" });
    expectCommonSecurityHeaders(res);
  });

  it("keeps headers on authenticated pages", async () => {
    const adam = await login(EMAILS.adam);
    const page = await workerFetch(`${LOCAL_HTTPS_ORIGIN}/admin`, {
      headers: { Cookie: adam.cookie },
    });
    expect(page.status).toBe(200);
    expectCommonSecurityHeaders(page);
    expect(page.headers.get("Strict-Transport-Security")).toBe(HSTS_VALUE);
  });

  it("serves /styles.css from ASSETS with immutable headers and still applies CSP", async () => {
    const css = "body{color:#1b1a17}";
    const raw = immutableAssetResponse(css, "text/css; charset=utf-8");
    expect(() => raw.headers.set("X-Test", "1")).toThrow(/immutable headers/);

    const assets = mockAssetsFetcher({
      "/styles.css": { body: css, contentType: "text/css; charset=utf-8" },
    });

    const res = await workerFetchWithEnv("https://crm.test/styles.css", undefined, { ASSETS: assets });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(css);
    expect(res.headers.get("Content-Type")).toMatch(/text\/css/);
    expectCommonSecurityHeaders(res);
    expect(res.headers.get("Content-Security-Policy")).toMatch(/style-src 'self'/);
    expect(res.headers.get("Strict-Transport-Security")).toBe(HSTS_VALUE);

    const http = await workerFetchWithEnv("http://crm.test/styles.css", undefined, { ASSETS: assets });
    expect(http.status).toBe(200);
    expectCommonSecurityHeaders(http);
    expect(http.headers.get("Strict-Transport-Security")).toBeNull();
  });

  it("serves /favicon.ico and /favicon.svg instead of 404", async () => {
    const ico = "ico-bytes";
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const assets = mockAssetsFetcher({
      "/favicon.ico": { body: ico, contentType: "image/x-icon" },
      "/favicon.svg": { body: svg, contentType: "image/svg+xml" },
    });

    const icon = await workerFetchWithEnv("https://crm.test/favicon.ico", undefined, { ASSETS: assets });
    expect(icon.status).toBe(200);
    expect(new TextDecoder().decode(await icon.arrayBuffer())).toBe(ico);
    expectCommonSecurityHeaders(icon);

    const mark = await workerFetchWithEnv("https://crm.test/favicon.svg", undefined, { ASSETS: assets });
    expect(mark.status).toBe(200);
    expect(await mark.text()).toBe(svg);
    expectCommonSecurityHeaders(mark);

    const loginPage = await workerFetch("https://crm.test/login");
    const html = await loginPage.text();
    expect(html).toMatch(/rel="icon"[^>]*href="\/favicon.svg"/);
    expect(html).toMatch(/rel="icon"[^>]*href="\/favicon.ico"/);

    const live = await workerFetch("https://crm.test/favicon.ico");
    expect(live.status).toBe(200);
    expect(live.headers.get("Content-Type") ?? "").toMatch(/icon|octet-stream|image\//);
  });
});
