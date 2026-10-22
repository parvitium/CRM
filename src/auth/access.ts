import type { Actor } from "../domain/authz";

/** Spoofable on any path that is not actually fronted by Access. Never treat as login. */
export const ACCESS_EMAIL_HEADER = "Cf-Access-Authenticated-User-Email";
export const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";

export type AccessBindings = {
  AUTH_MODE?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
};

export type AccessIdentity = { email: string };

type JwtHeader = { alg?: string; kid?: string; typ?: string };
type AccessJwtPayload = {
  aud?: string | string[];
  email?: string;
  iss?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
};

type JwkRsa = JsonWebKey & { kid?: string; alg?: string; use?: string };
type Jwks = { keys?: JwkRsa[] };

type JwksFetcher = (url: string) => Promise<Response>;

const CLOCK_SKEW_SECONDS = 60;
const JWKS_TTL_MS = 60_000;

const defaultJwksFetcher: JwksFetcher = (url) => fetch(url);

let jwksFetcher: JwksFetcher = defaultJwksFetcher;
const jwksCache = new Map<string, { fetchedAt: number; keys: JwkRsa[] }>();

/** Test-only: stub JWKS HTTP so verification can run without a live Access team. */
export function setAccessJwksFetcher(fetcher: JwksFetcher | null): void {
  jwksFetcher = fetcher ?? defaultJwksFetcher;
}

export function resetAccessTestHooks(): void {
  jwksFetcher = defaultJwksFetcher;
  jwksCache.clear();
}

export function normalizeTeamDomain(raw: string): string {
  let value = raw.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (value && !value.includes(".")) {
    value = `${value}.cloudflareaccess.com`;
  }
  return value;
}

export function accessJwksUrl(teamDomain: string): string {
  return `https://${normalizeTeamDomain(teamDomain)}/cdn-cgi/access/certs`;
}

export function accessIssuer(teamDomain: string): string {
  return `https://${normalizeTeamDomain(teamDomain)}`;
}

export function isAccessAuthMode(mode: string | undefined): boolean {
  return String(mode ?? "").trim().toLowerCase() === "access";
}

/**
 * Map a Cloudflare Access JWT to a CRM user.
 * The email header is ignored. Identity comes only from a verified JWT when AUTH_MODE=access.
 */
export async function loadActorFromAccess(
  db: D1Database,
  request: Request,
  env: AccessBindings,
): Promise<Actor | null> {
  if (!isAccessAuthMode(env.AUTH_MODE)) {
    return null;
  }
  const teamDomain = String(env.CF_ACCESS_TEAM_DOMAIN ?? "").trim();
  const aud = String(env.CF_ACCESS_AUD ?? "").trim();
  if (!teamDomain || !aud) {
    return null;
  }
  const jwt = request.headers.get(ACCESS_JWT_HEADER)?.trim();
  if (!jwt) {
    return null;
  }
  const identity = await verifyAccessJwt(jwt, { teamDomain, aud });
  if (!identity) {
    return null;
  }
  const row = await db
    .prepare("SELECT id, email, display_name, role, customer_id FROM users WHERE email = ?")
    .bind(identity.email)
    .first<{
      id: string;
      email: string;
      display_name: string;
      role: Actor["role"];
      customer_id: string | null;
    }>();
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    customerId: row.customer_id,
  };
}

export async function verifyAccessJwt(
  jwt: string,
  opts: { teamDomain: string; aud: string },
): Promise<AccessIdentity | null> {
  const parts = jwt.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return null;
  }
  const header = decodeBase64UrlJson<JwtHeader>(parts[0]);
  const payload = decodeBase64UrlJson<AccessJwtPayload>(parts[1]);
  if (!header || !payload) {
    return null;
  }
  if (header.alg !== "RS256") {
    return null;
  }
  const teamDomain = normalizeTeamDomain(opts.teamDomain);
  if (!teamDomain || !opts.aud) {
    return null;
  }
  if (payload.iss !== accessIssuer(teamDomain)) {
    return null;
  }
  if (!audienceIncludes(payload.aud, opts.aud)) {
    return null;
  }
  if (!payload.exp || !Number.isFinite(payload.exp)) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp + CLOCK_SKEW_SECONDS <= now) {
    return null;
  }
  if (payload.nbf !== undefined && payload.nbf - CLOCK_SKEW_SECONDS > now) {
    return null;
  }
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email.includes("@")) {
    return null;
  }

  const keys = await loadJwks(accessJwksUrl(teamDomain));
  if (!keys) {
    return null;
  }
  const candidates = keys.filter((key) => {
    if (key.kty !== "RSA" || !key.n || !key.e) {
      return false;
    }
    if (header.kid && key.kid && key.kid !== header.kid) {
      return false;
    }
    return true;
  });
  const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlToBytes(parts[2]);
  if (!signature) {
    return null;
  }
  for (const jwk of candidates) {
    try {
      const key = await crypto.subtle.importKey(
        "jwk",
        { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      );
      const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signedData);
      if (ok) {
        return { email };
      }
    } catch {
      // try the next JWKS key
    }
  }
  return null;
}

function audienceIncludes(aud: string | string[] | undefined, expected: string): boolean {
  if (typeof aud === "string") {
    return aud === expected;
  }
  return Array.isArray(aud) && aud.includes(expected);
}

async function loadJwks(url: string): Promise<JwkRsa[] | null> {
  const cached = jwksCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS) {
    return cached.keys;
  }
  try {
    const res = await jwksFetcher(url);
    if (!res.ok) {
      return null;
    }
    const body = (await res.json()) as Jwks;
    const keys = Array.isArray(body.keys) ? body.keys : [];
    jwksCache.set(url, { fetchedAt: Date.now(), keys });
    return keys;
  } catch {
    return null;
  }
}

function decodeBase64UrlJson<T>(part: string): T | null {
  const bytes = base64UrlToBytes(part);
  if (!bytes) {
    return null;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

function base64UrlToBytes(value: string): Uint8Array | null {
  try {
    const pad = "=".repeat((4 - (value.length % 4)) % 4);
    const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}
