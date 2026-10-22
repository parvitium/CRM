import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { ACCESS_EMAIL_HEADER, ACCESS_JWT_HEADER, resetAccessTestHooks, setAccessJwksFetcher } from "../../src/auth/access";
import { EMAILS } from "../../src/ids";
import { seedSql, workerFetch, workerFetchWithEnv } from "../helpers";
import {
  generateAccessTestKey,
  mockJwksResponse,
  signAccessJwt,
  TEST_ACCESS_AUD,
  TEST_ACCESS_TEAM,
  validAccessClaims,
} from "../auth/jwt";

describe("health", () => {
  beforeAll(async () => {
    await seedSql();
  });

  afterEach(() => {
    resetAccessTestHooks();
  });

  it("returns ok without auth", async () => {
    const res = await workerFetch("https://crm.test/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("treats /health/ like /health", async () => {
    const res = await workerFetch("https://crm.test/health/");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, service: "parvitium-crm" });
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("never mints a session from Access headers", async () => {
    const before = await env.DB.prepare("SELECT COUNT(*) AS n FROM sessions").first<{ n: number }>();
    const spoof = await workerFetch("https://crm.test/health", {
      headers: { [ACCESS_EMAIL_HEADER]: EMAILS.adam },
    });
    expect(spoof.status).toBe(200);
    expect(spoof.headers.get("Set-Cookie")).toBeNull();

    const key = await generateAccessTestKey();
    const jwt = await signAccessJwt(key.privateKey, validAccessClaims(EMAILS.adam));
    setAccessJwksFetcher(async () => mockJwksResponse(key.publicJwk));
    const verified = await workerFetchWithEnv(
      "https://crm.test/health",
      {
        headers: {
          [ACCESS_EMAIL_HEADER]: EMAILS.adam,
          [ACCESS_JWT_HEADER]: jwt,
        },
      },
      {
        AUTH_MODE: "access",
        CF_ACCESS_TEAM_DOMAIN: TEST_ACCESS_TEAM,
        CF_ACCESS_AUD: TEST_ACCESS_AUD,
      },
    );
    expect(verified.status).toBe(200);
    expect(verified.headers.get("Set-Cookie")).toBeNull();

    const trailing = await workerFetchWithEnv(
      "https://crm.test/health/",
      {
        headers: {
          [ACCESS_EMAIL_HEADER]: EMAILS.adam,
          [ACCESS_JWT_HEADER]: jwt,
        },
      },
      {
        AUTH_MODE: "access",
        CF_ACCESS_TEAM_DOMAIN: TEST_ACCESS_TEAM,
        CF_ACCESS_AUD: TEST_ACCESS_AUD,
      },
    );
    expect(trailing.status).toBe(200);
    expect(await trailing.json()).toMatchObject({ ok: true });
    expect(trailing.headers.get("Set-Cookie")).toBeNull();

    const after = await env.DB.prepare("SELECT COUNT(*) AS n FROM sessions").first<{ n: number }>();
    expect(after?.n).toBe(before?.n ?? 0);
  });
});
