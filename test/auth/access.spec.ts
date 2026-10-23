import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import {
  ACCESS_EMAIL_HEADER,
  ACCESS_JWT_HEADER,
  isAccessMisconfigured,
  isDevLoginAllowed,
  isLocalDevAuth,
  isLoopbackHost,
  loadActorFromAccess,
  resetAccessTestHooks,
  setAccessJwksFetcher,
  verifyAccessJwt,
} from "../../src/auth/access";
import { AuthzError } from "../../src/domain/authz";
import { EMAILS } from "../../src/ids";
import { seedSql } from "../helpers";
import {
  generateAccessTestKey,
  mockJwksResponse,
  signAccessJwt,
  TEST_ACCESS_AUD,
  TEST_ACCESS_TEAM,
  validAccessClaims,
} from "./jwt";

const ACCESS_ENV = {
  AUTH_MODE: "access",
  CF_ACCESS_TEAM_DOMAIN: TEST_ACCESS_TEAM,
  CF_ACCESS_AUD: TEST_ACCESS_AUD,
};

describe("local-dev vs Access gates", () => {
  it("treats only loopback hosts as local", () => {
    expect(isLoopbackHost("http://127.0.0.1:8787/admin")).toBe(true);
    expect(isLoopbackHost("https://localhost/login")).toBe(true);
    expect(isLoopbackHost("http://[::1]/")).toBe(true);
    expect(isLoopbackHost("https://crm.test/admin")).toBe(false);
    expect(isLoopbackHost("https://parvitium-crm.workers.dev/")).toBe(false);
  });

  it("allows cookie auth only when AUTH_MODE=dev on loopback", () => {
    const dev = { AUTH_MODE: "dev", ALLOW_DEV_LOGIN: "true" };
    const access = { AUTH_MODE: "access", ALLOW_DEV_LOGIN: "true" };
    expect(isLocalDevAuth(dev, "http://127.0.0.1:8787/")).toBe(true);
    expect(isDevLoginAllowed(dev, "http://127.0.0.1:8787/")).toBe(true);
    expect(isLocalDevAuth(dev, "https://crm.test/")).toBe(false);
    expect(isDevLoginAllowed(dev, "https://crm.test/")).toBe(false);
    expect(isLocalDevAuth(access, "http://127.0.0.1:8787/")).toBe(false);
    expect(isDevLoginAllowed(access, "http://127.0.0.1:8787/")).toBe(false);
  });

  it("is misconfigured when Access is required but team or AUD is empty", () => {
    const empty = { AUTH_MODE: "access", CF_ACCESS_TEAM_DOMAIN: "", CF_ACCESS_AUD: "" };
    expect(isAccessMisconfigured(empty, "https://crm.test/api/me")).toBe(true);
    expect(isAccessMisconfigured(empty, "http://127.0.0.1:8787/api/me")).toBe(true);
    expect(
      isAccessMisconfigured(
        { AUTH_MODE: "dev", CF_ACCESS_TEAM_DOMAIN: "", CF_ACCESS_AUD: "" },
        "https://crm.test/api/me",
      ),
    ).toBe(true);
    expect(
      isAccessMisconfigured(
        { AUTH_MODE: "dev", CF_ACCESS_TEAM_DOMAIN: "", CF_ACCESS_AUD: "" },
        "http://127.0.0.1:8787/api/me",
      ),
    ).toBe(false);
  });
});

describe("Cloudflare Access JWT", () => {
  beforeAll(async () => {
    await seedSql();
  });

  afterEach(() => {
    resetAccessTestHooks();
  });

  it("verifies a mocked JWKS path and maps the JWT email to the user", async () => {
    const key = await generateAccessTestKey();
    const jwt = await signAccessJwt(key.privateKey, validAccessClaims(EMAILS.adam));
    let jwksUrl = "";
    setAccessJwksFetcher(async (url) => {
      jwksUrl = url;
      return mockJwksResponse(key.publicJwk);
    });

    const identity = await verifyAccessJwt(jwt, {
      teamDomain: TEST_ACCESS_TEAM,
      aud: TEST_ACCESS_AUD,
    });
    expect(identity).toEqual({ email: EMAILS.adam });
    expect(jwksUrl).toBe(`https://${TEST_ACCESS_TEAM}/cdn-cgi/access/certs`);

    const actor = await loadActorFromAccess(
      env.DB,
      new Request("https://crm.test/api/me", {
        headers: { [ACCESS_JWT_HEADER]: jwt },
      }),
      ACCESS_ENV,
    );
    expect(actor?.email).toBe(EMAILS.adam);
    expect(actor?.role).toBe("admin");
  });

  it("rejects a spoofed Access email header even in AUTH_MODE=access", async () => {
    const actor = await loadActorFromAccess(
      env.DB,
      new Request("https://crm.test/api/me", {
        headers: { [ACCESS_EMAIL_HEADER]: EMAILS.adam },
      }),
      ACCESS_ENV,
    );
    expect(actor).toBeNull();
  });

  it("ignores a valid JWT when Access is not configured", async () => {
    const key = await generateAccessTestKey();
    const jwt = await signAccessJwt(key.privateKey, validAccessClaims(EMAILS.adam));
    setAccessJwksFetcher(async () => mockJwksResponse(key.publicJwk));
    const actor = await loadActorFromAccess(
      env.DB,
      new Request("https://crm.test/api/me", {
        headers: {
          [ACCESS_EMAIL_HEADER]: EMAILS.adam,
          [ACCESS_JWT_HEADER]: jwt,
        },
      }),
      { AUTH_MODE: "access", CF_ACCESS_TEAM_DOMAIN: "", CF_ACCESS_AUD: "" },
    );
    expect(actor).toBeNull();
  });

  it("throws 403 when the JWT email is not an admin user", async () => {
    const key = await generateAccessTestKey();
    const jwt = await signAccessJwt(key.privateKey, validAccessClaims("nobody@example.test"));
    setAccessJwksFetcher(async () => mockJwksResponse(key.publicJwk));
    await expect(
      loadActorFromAccess(
        env.DB,
        new Request("https://crm.test/api/me", {
          headers: { [ACCESS_JWT_HEADER]: jwt },
        }),
        ACCESS_ENV,
      ),
    ).rejects.toBeInstanceOf(AuthzError);
  });

  it("rejects a JWT with the wrong audience", async () => {
    const key = await generateAccessTestKey();
    const jwt = await signAccessJwt(
      key.privateKey,
      validAccessClaims(EMAILS.adam, { aud: ["other-aud"] }),
    );
    setAccessJwksFetcher(async () => mockJwksResponse(key.publicJwk));
    const identity = await verifyAccessJwt(jwt, {
      teamDomain: TEST_ACCESS_TEAM,
      aud: TEST_ACCESS_AUD,
    });
    expect(identity).toBeNull();
  });

  it("rejects an expired JWT", async () => {
    const key = await generateAccessTestKey();
    const jwt = await signAccessJwt(
      key.privateKey,
      validAccessClaims(EMAILS.adam, { exp: Math.floor(Date.now() / 1000) - 120 }),
    );
    setAccessJwksFetcher(async () => mockJwksResponse(key.publicJwk));
    const identity = await verifyAccessJwt(jwt, {
      teamDomain: TEST_ACCESS_TEAM,
      aud: TEST_ACCESS_AUD,
    });
    expect(identity).toBeNull();
  });

  it("rejects a JWT with a bad signature", async () => {
    const key = await generateAccessTestKey();
    const other = await generateAccessTestKey();
    const jwt = await signAccessJwt(other.privateKey, validAccessClaims(EMAILS.adam));
    setAccessJwksFetcher(async () => mockJwksResponse(key.publicJwk));
    const identity = await verifyAccessJwt(jwt, {
      teamDomain: TEST_ACCESS_TEAM,
      aud: TEST_ACCESS_AUD,
    });
    expect(identity).toBeNull();
  });
});
