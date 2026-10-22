import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { ACCESS_EMAIL_HEADER, ACCESS_JWT_HEADER, resetAccessTestHooks, setAccessJwksFetcher } from "../../src/auth/access";
import { sha256Hex } from "../../src/auth/crypto";
import { MAGIC_ISSUE_MIN_MS } from "../../src/auth/magic-link";
import { EMAILS } from "../../src/ids";
import {
  consumeMagic,
  hiddenInput,
  issueMagicToken,
  json,
  login,
  openMagicConfirm,
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

describe("auth", () => {
  beforeAll(async () => {
    await seedSql();
  });

  afterEach(() => {
    resetAccessTestHooks();
  });

  it("issues a magic link without revealing whether the email exists", async () => {
    const knownStarted = Date.now();
    const known = await workerFetch("https://crm.test/auth/magic", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: EMAILS.adam }).toString(),
      redirect: "manual",
    });
    const knownMs = Date.now() - knownStarted;

    const unknownStarted = Date.now();
    const unknown = await workerFetch("https://crm.test/auth/magic", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: "nobody@example.test" }).toString(),
      redirect: "manual",
    });
    const unknownMs = Date.now() - unknownStarted;

    expect(known.status).toBe(302);
    expect(unknown.status).toBe(302);
    expect(known.status).toBe(unknown.status);
    expect(known.headers.get("Location")).toBe(unknown.headers.get("Location"));
    expect(await known.text()).toBe(await unknown.text());
    expect(known.headers.get("Content-Security-Policy")).toBe(
      unknown.headers.get("Content-Security-Policy"),
    );

    expect(knownMs).toBeGreaterThanOrEqual(MAGIC_ISSUE_MIN_MS - 10);
    expect(unknownMs).toBeGreaterThanOrEqual(MAGIC_ISSUE_MIN_MS - 10);

    const mailed = await env.DB.prepare(
      "SELECT body FROM outbound_emails WHERE to_email = ? ORDER BY created_at DESC LIMIT 1",
    )
      .bind(EMAILS.adam)
      .first<{ body: string }>();
    expect(mailed?.body).toMatch(/\/auth\/magic\?token=/);

    const none = await env.DB.prepare("SELECT COUNT(*) AS n FROM outbound_emails WHERE to_email = ?")
      .bind("nobody@example.test")
      .first<{ n: number }>();
    expect(none?.n).toBe(0);

    const unknownLinks = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM magic_links WHERE email = ?",
    )
      .bind("nobody@example.test")
      .first<{ n: number }>();
    expect(unknownLinks?.n).toBe(0);
  });

  it("does not log the raw magic-link token", async () => {
    const lines: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;
    const capture = (...args: unknown[]) => {
      lines.push(args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "));
    };
    console.log = capture;
    console.error = capture;
    try {
      const token = await issueMagicToken(EMAILS.desert);
      await openMagicConfirm(token);
      const dumped = lines.join("\n");
      expect(token).toBeTruthy();
      expect(dumped).not.toContain(token);
      expect(dumped).not.toMatch(/token=/);
      const stored = await env.DB.prepare(
        "SELECT token_hash FROM magic_links ORDER BY created_at DESC LIMIT 1",
      ).first<{ token_hash: string }>();
      expect(stored?.token_hash).toBe(await sha256Hex(token));
      expect(stored?.token_hash).not.toBe(token);
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
  });

  it("shows a confirm page on GET and consumes the token on CSRF POST", async () => {
    const token = await issueMagicToken(EMAILS.lakeview);
    const firstPeek = await env.DB.prepare(
      "SELECT used_at FROM magic_links ORDER BY created_at DESC LIMIT 1",
    ).first<{ used_at: string | null }>();
    expect(firstPeek?.used_at).toBeNull();

    const confirm = await openMagicConfirm(token);
    expect(confirm.firstStatus).toBe(303);
    expect(confirm.firstLocation).toMatch(/\/auth\/magic$/);
    expect(confirm.firstLocation ?? "").not.toContain("token=");
    expect(confirm.firstHeaders.get("Referrer-Policy")).toBe("no-referrer");
    expect(confirm.status).toBe(200);
    expect(confirm.html).toMatch(/Confirm sign-in/);
    expect(confirm.html).not.toContain(token);
    expect(confirm.html).not.toContain("name=\"token\"");
    expect(confirm.html).toMatch(/name="referrer" content="no-referrer"/);
    expect(confirm.csrf).toBeTruthy();
    expect(confirm.cookie).toMatch(/pv_magic_csrf=/);
    expect(confirm.cookie).toMatch(/pv_magic_token=/);
    expect(confirm.setCookie ?? "").not.toMatch(/pv_session=/);

    const stillUnused = await env.DB.prepare(
      "SELECT used_at FROM magic_links ORDER BY created_at DESC LIMIT 1",
    ).first<{ used_at: string | null }>();
    expect(stillUnused?.used_at).toBeNull();

    const missingCsrf = await consumeMagic("", confirm.cookie ?? "");
    expect(missingCsrf.status).toBe(403);
    const unusedAfterReject = await env.DB.prepare(
      "SELECT used_at FROM magic_links ORDER BY created_at DESC LIMIT 1",
    ).first<{ used_at: string | null }>();
    expect(unusedAfterReject?.used_at).toBeNull();

    const consume = await consumeMagic(confirm.csrf ?? "", confirm.cookie ?? "");
    expect(consume.status).toBe(302);
    expect(consume.headers.get("Location")).toMatch(/\/portal$/);
    expect(consume.headers.get("Set-Cookie")).toMatch(/pv_session=/);
    expect(consume.headers.get("Set-Cookie")).toMatch(/HttpOnly/);
  });

  it("rejects an expired magic-link token on consume", async () => {
    const token = await issueMagicToken(EMAILS.copper);
    const confirm = await openMagicConfirm(token);
    expect(confirm.status).toBe(200);
    await env.DB.prepare("UPDATE magic_links SET expires_at = ? WHERE token_hash = ?")
      .bind("2000-01-01T00:00:00.000Z", await sha256Hex(token))
      .run();
    const consume = await consumeMagic(confirm.csrf ?? "", confirm.cookie ?? "");
    expect(consume.status).toBe(302);
    expect(consume.headers.get("Location")).toMatch(/invalid|expired/);
    expect(consume.headers.get("Set-Cookie") ?? "").not.toMatch(/pv_session=/);
  });

  it("rejects reuse of a consumed magic-link token", async () => {
    const token = await issueMagicToken(EMAILS.summit);
    const confirm = await openMagicConfirm(token);
    const first = await consumeMagic(confirm.csrf ?? "", confirm.cookie ?? "");
    expect(first.status).toBe(302);
    expect(first.headers.get("Set-Cookie")).toMatch(/pv_session=/);

    const reuseConfirm = await openMagicConfirm(token);
    expect(reuseConfirm.status).toBe(302);
    expect(reuseConfirm.setCookie ?? "").not.toMatch(/pv_session=/);

    const reuse = await consumeMagic(confirm.csrf ?? "", confirm.cookie ?? "");
    expect(reuse.status).toBe(302);
    expect(reuse.headers.get("Location")).toMatch(/invalid|expired/);
    expect(reuse.headers.get("Set-Cookie") ?? "").not.toMatch(/pv_session=/);
  });

  it("rejects a spoofed Cf-Access-Authenticated-User-Email header", async () => {
    const res = await json<{ email?: string; error?: string }>("/api/me");
    expect(res.status).toBe(401);

    const spoof = await workerFetch("https://crm.test/api/me", {
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

  it("accepts Access identity only after a mocked JWT verifies in AUTH_MODE=access", async () => {
    const key = await generateAccessTestKey();
    const jwt = await signAccessJwt(key.privateKey, validAccessClaims(EMAILS.adam));
    setAccessJwksFetcher(async (url) => {
      expect(url).toBe(`https://${TEST_ACCESS_TEAM}/cdn-cgi/access/certs`);
      return mockJwksResponse(key.publicJwk);
    });
    const accessEnv = {
      AUTH_MODE: "access",
      CF_ACCESS_TEAM_DOMAIN: TEST_ACCESS_TEAM,
      CF_ACCESS_AUD: TEST_ACCESS_AUD,
    };

    const headerOnly = await workerFetchWithEnv(
      "https://crm.test/api/me",
      {
        headers: {
          Accept: "application/json",
          [ACCESS_EMAIL_HEADER]: EMAILS.adam,
        },
      },
      accessEnv,
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
      accessEnv,
    );
    expect(verified.status).toBe(200);
    const body = (await verified.json()) as { email: string; role: string };
    expect(body.email).toBe(EMAILS.adam);
    expect(body.role).toBe("admin");
    expect(verified.headers.get("Set-Cookie")).toMatch(/pv_session=/);
  });

  it("requires CSRF on POST logout and rejects GET", async () => {
    const adam = await login(EMAILS.adam);
    const page = await workerFetch("https://crm.test/admin", {
      headers: { Cookie: adam.cookie },
    });
    const html = await page.text();
    expect(html).toMatch(/action="\/logout"/);
    expect(hiddenInput(html, "csrf")).toBe(adam.csrf);

    const getLogout = await workerFetch("https://crm.test/logout", { redirect: "manual" });
    expect(getLogout.status).toBe(405);
    expect(getLogout.headers.get("Allow")).toBe("POST");
    const stillIn = await workerFetch("https://crm.test/api/me", {
      headers: { Cookie: adam.cookie, Accept: "application/json" },
    });
    expect(stillIn.status).toBe(200);

    const noCsrf = await workerFetch("https://crm.test/logout", {
      method: "POST",
      headers: {
        Cookie: adam.cookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({}).toString(),
      redirect: "manual",
    });
    expect(noCsrf.status).toBe(403);

    const out = await workerFetch("https://crm.test/logout", {
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
    const after = await workerFetch("https://crm.test/api/me", {
      headers: { Cookie: adam.cookie, Accept: "application/json" },
    });
    expect(after.status).toBe(401);
  });

  it("rejects a CSRF-less POST after login", async () => {
    const adam = await login(EMAILS.adam);
    const res = await workerFetch("https://crm.test/api/admin/tickets", {
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
});
