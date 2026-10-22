import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import {
  ACCESS_EMAIL_HEADER,
  ACCESS_JWT_HEADER,
  loadActorFromAccess,
  resetAccessTestHooks,
  setAccessJwksFetcher,
  verifyAccessJwt,
} from "../../src/auth/access";
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

  it("ignores a valid JWT when AUTH_MODE=magic", async () => {
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
      { ...ACCESS_ENV, AUTH_MODE: "magic" },
    );
    expect(actor).toBeNull();
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
