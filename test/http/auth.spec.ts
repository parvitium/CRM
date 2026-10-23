import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ACCESS_EMAIL_HEADER, ACCESS_JWT_HEADER, resetAccessTestHooks, setAccessJwksFetcher } from "../../src/auth/access";
import { HOST_SESSION_COOKIE } from "../../src/auth/session";
import { EMAILS } from "../../src/ids";
import {
  getSetCookies,
  hiddenInput,
  json,
  LOCAL_HTTPS_ORIGIN,
  localUrl,
  login,
  seedSql,
  workerFetch,
  workerFetchWithEnv,
} from "../helpers";
import {
  generateAccessTestKey,
  mockJwksResponse,
  signAccessJwt,
  TEST_ACCESS_AUD,
  TEST_ACCESS_TEAM,
  validAccessClaims,
} from "../auth/jwt";

const ACCESS_ENV = {
  AUTH_MODE: "access",
  CF_ACCESS_TEAM_DOMAIN: TEST_ACCESS_TEAM,
  CF_ACCESS_AUD: TEST_ACCESS_AUD,
};

describe("auth", () => {
  beforeAll(async () => {
    await seedSql();
  });

  afterEach(() => {
    resetAccessTestHooks();
  });

  it("has no magic-link routes", async () => {
    const post = await workerFetch("https://crm.test/auth/magic", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: EMAILS.adam }).toString(),
      redirect: "manual",
    });
    expect([403, 404]).toContain(post.status);
    const get = await workerFetch("https://crm.test/auth/magic?token=deadbeef", {
      redirect: "manual",
    });
    expect(get.status).toBe(404);
  });

  it("sets __Host-pv_session on HTTPS with Secure, Path=/, no Domain", async () => {
    const res = await workerFetch(`${LOCAL_HTTPS_ORIGIN}/auth/dev-login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: EMAILS.adam }).toString(),
      redirect: "manual",
    });
    const cookie = getSetCookies(res).find((part) => part.includes("pv_session=")) ?? "";
    expect(cookie.startsWith(`${HOST_SESSION_COOKIE}=`)).toBe(true);
    expect(cookie).toMatch(/;\s*Secure(?:;|$)/);
    expect(cookie).toMatch(/;\s*Path=\/(?:;|$)/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).not.toMatch(/;\s*Domain=/i);
    expect(res.headers.get("Location")).toMatch(/\/admin$/);
  });

  it("falls back to pv_session without Secure on HTTP", async () => {
    const res = await workerFetch("http://127.0.0.1:8787/auth/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: EMAILS.adam }).toString(),
      redirect: "manual",
    });
    const cookie = getSetCookies(res).find((part) => part.includes("pv_session=")) ?? "";
    expect(cookie.startsWith("pv_session=")).toBe(true);
    expect(cookie).not.toContain("__Host-");
    expect(cookie).not.toMatch(/;\s*Secure(?:;|$)/);
    expect(cookie).toMatch(/;\s*Path=\/(?:;|$)/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it("rejects a spoofed Cf-Access-Authenticated-User-Email header", async () => {
    const res = await json<{ email?: string; error?: string }>("/api/me");
    expect(res.status).toBe(401);

    const spoof = await workerFetch(localUrl("/api/me"), {
      headers: {
        Accept: "application/json",
        [ACCESS_EMAIL_HEADER]: EMAILS.adam,
      },
    });
    expect(spoof.status).toBe(401);
    expect(spoof.headers.get("Set-Cookie")).toBeNull();
    const body = (await spoof.json()) as { error?: string };
    expect(body.error).toMatch(/sign in/i);
  });

  it("accepts Access identity only after a mocked JWT verifies", async () => {
    const key = await generateAccessTestKey();
    const jwt = await signAccessJwt(key.privateKey, validAccessClaims(EMAILS.adam));
    setAccessJwksFetcher(async (url) => {
      expect(url).toBe(`https://${TEST_ACCESS_TEAM}/cdn-cgi/access/certs`);
      return mockJwksResponse(key.publicJwk);
    });

    const headerOnly = await workerFetchWithEnv(
      "https://crm.test/api/me",
      {
        headers: {
          Accept: "application/json",
          [ACCESS_EMAIL_HEADER]: EMAILS.adam,
        },
      },
      ACCESS_ENV,
    );
    expect(headerOnly.status).toBe(401);
    expect(headerOnly.headers.get("Set-Cookie")).toBeNull();

    const verified = await workerFetchWithEnv(
      "https://crm.test/api/me",
      {
        headers: {
          Accept: "application/json",
          [ACCESS_EMAIL_HEADER]: "attacker@example.test",
          [ACCESS_JWT_HEADER]: jwt,
        },
      },
      ACCESS_ENV,
    );
    expect(verified.status).toBe(200);
    const body = (await verified.json()) as { email: string; role: string };
    expect(body.email).toBe(EMAILS.adam);
    expect(body.role).toBe("admin");
    expect(verified.headers.get("Set-Cookie")).toMatch(/pv_session=/);
  });

  it("returns 403 when a verified JWT email is not an admin user", async () => {
    const key = await generateAccessTestKey();
    const jwt = await signAccessJwt(
      key.privateKey,
      validAccessClaims("stranger@example.test"),
    );
    setAccessJwksFetcher(async () => mockJwksResponse(key.publicJwk));
    const res = await workerFetchWithEnv(
      "https://crm.test/api/me",
      {
        headers: {
          Accept: "application/json",
          [ACCESS_JWT_HEADER]: jwt,
        },
      },
      ACCESS_ENV,
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/not an admin/i);
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("ignores a leftover session cookie when Access is configured and the JWT is missing", async () => {
    const adam = await login(EMAILS.adam);
    const res = await workerFetchWithEnv(
      "https://crm.test/api/me",
      {
        headers: {
          Accept: "application/json",
          Cookie: adam.cookie,
        },
      },
      ACCESS_ENV,
    );
    expect(res.status).toBe(401);
  });

  it("requires CSRF on POST logout and rejects GET", async () => {
    const adam = await login(EMAILS.adam);
    const page = await workerFetch(localUrl("/admin"), {
      headers: { Cookie: adam.cookie },
    });
    const html = await page.text();
    expect(html).toMatch(/action="\/logout"/);
    expect(hiddenInput(html, "csrf")).toBe(adam.csrf);

    const getLogout = await workerFetch(localUrl("/logout"), { redirect: "manual" });
    expect(getLogout.status).toBe(405);
    expect(getLogout.headers.get("Allow")).toBe("POST");
    const stillIn = await workerFetch(localUrl("/api/me"), {
      headers: { Cookie: adam.cookie, Accept: "application/json" },
    });
    expect(stillIn.status).toBe(200);

    const noCsrf = await workerFetch(localUrl("/logout"), {
      method: "POST",
      headers: {
        Cookie: adam.cookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({}).toString(),
      redirect: "manual",
    });
    expect(noCsrf.status).toBe(403);

    const out = await workerFetch(localUrl("/logout"), {
      method: "POST",
      headers: {
        Cookie: adam.cookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ csrf: adam.csrf }).toString(),
      redirect: "manual",
    });
    expect(out.status).toBe(302);
    expect(out.headers.get("Location")).toMatch(/\/login$/);
    const after = await workerFetch(localUrl("/api/me"), {
      headers: { Cookie: adam.cookie, Accept: "application/json" },
    });
    expect(after.status).toBe(401);
  });

  it("rejects a CSRF-less POST after login", async () => {
    const adam = await login(EMAILS.adam);
    const res = await workerFetch(localUrl("/api/admin/tickets"), {
      method: "POST",
      headers: {
        Cookie: adam.cookie,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "no csrf", type: "task" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 403 on every admin and API route when AUTH_MODE=access and team/AUD are empty", async () => {
    const emptyAccess = {
      AUTH_MODE: "access",
      ALLOW_DEV_LOGIN: "true",
      CF_ACCESS_TEAM_DOMAIN: "",
      CF_ACCESS_AUD: "",
    };
    const adam = await login(EMAILS.adam);
    for (const path of ["/api/me", "/api/admin/tickets", "/admin", "/admin/customers"]) {
      const res = await workerFetchWithEnv(
        `https://crm.test${path}`,
        {
          headers: { Accept: "application/json", Cookie: adam.cookie },
          redirect: "manual",
        },
        emptyAccess,
      );
      expect(res.status, path).toBe(403);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toMatch(/Access is not configured/i);
    }

    const localAccess = await workerFetchWithEnv(
      "http://127.0.0.1:8787/api/me",
      { headers: { Accept: "application/json", Cookie: adam.cookie } },
      emptyAccess,
    );
    expect(localAccess.status).toBe(403);
  });

  it("returns 403 on admin and API when AUTH_MODE=dev on a non-loopback host without Access vars", async () => {
    const res = await workerFetchWithEnv(
      "https://crm.test/api/me",
      { headers: { Accept: "application/json" } },
      { AUTH_MODE: "dev", ALLOW_DEV_LOGIN: "true", CF_ACCESS_TEAM_DOMAIN: "", CF_ACCESS_AUD: "" },
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 for /auth/dev-login when AUTH_MODE=access, including localhost", async () => {
    for (const url of [
      "https://crm.test/auth/dev-login",
      "http://127.0.0.1:8787/auth/dev-login",
      `${LOCAL_HTTPS_ORIGIN}/auth/dev-login`,
    ]) {
      const res = await workerFetchWithEnv(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ email: EMAILS.adam }).toString(),
          redirect: "manual",
        },
        { AUTH_MODE: "access", ALLOW_DEV_LOGIN: "true", CF_ACCESS_TEAM_DOMAIN: "", CF_ACCESS_AUD: "" },
      );
      expect(res.status, url).toBe(404);
      expect(res.headers.get("Set-Cookie")).toBeNull();
    }
  });

  it("returns 403 for /auth/dev-login on a non-loopback host even when AUTH_MODE=dev", async () => {
    const res = await workerFetchWithEnv(
      "https://crm.test/auth/dev-login",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email: EMAILS.adam }).toString(),
        redirect: "manual",
      },
      { AUTH_MODE: "dev", ALLOW_DEV_LOGIN: "true", CF_ACCESS_TEAM_DOMAIN: "", CF_ACCESS_AUD: "" },
    );
    expect(res.status).toBe(403);
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("rejects a leftover dev session cookie in AUTH_MODE=access even with a valid JWT env", async () => {
    const adam = await login(EMAILS.adam);
    const missingJwt = await workerFetchWithEnv(
      "https://crm.test/api/me",
      {
        headers: { Accept: "application/json", Cookie: adam.cookie },
      },
      ACCESS_ENV,
    );
    expect(missingJwt.status).toBe(401);

    const emptyAud = await workerFetchWithEnv(
      "https://crm.test/api/me",
      {
        headers: { Accept: "application/json", Cookie: adam.cookie },
      },
      { AUTH_MODE: "access", ALLOW_DEV_LOGIN: "true", CF_ACCESS_TEAM_DOMAIN: "", CF_ACCESS_AUD: "" },
    );
    expect(emptyAud.status).toBe(403);
  });

  it("rejects the Access email header alone when Access is configured", async () => {
    const res = await workerFetchWithEnv(
      "https://crm.test/api/me",
      {
        headers: {
          Accept: "application/json",
          [ACCESS_EMAIL_HEADER]: EMAILS.adam,
        },
      },
      ACCESS_ENV,
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("returns 200 for a valid Access JWT", async () => {
    const key = await generateAccessTestKey();
    const jwt = await signAccessJwt(key.privateKey, validAccessClaims(EMAILS.adam));
    setAccessJwksFetcher(async () => mockJwksResponse(key.publicJwk));
    const res = await workerFetchWithEnv(
      "https://crm.test/api/me",
      {
        headers: {
          Accept: "application/json",
          [ACCESS_JWT_HEADER]: jwt,
        },
      },
      ACCESS_ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { email: string; role: string };
    expect(body.email).toBe(EMAILS.adam);
    expect(body.role).toBe("admin");
  });
});
