export const TEST_ACCESS_TEAM = "test.cloudflareaccess.com";
export const TEST_ACCESS_AUD = "test-access-aud";
export const TEST_ACCESS_KID = "test-access-kid";

export type TestAccessKey = {
  privateKey: CryptoKey;
  publicJwk: JsonWebKey & { kid: string; alg: string; use: string };
};

export async function generateAccessTestKey(): Promise<TestAccessKey> {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const publicJwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  return {
    privateKey: pair.privateKey,
    publicJwk: {
      ...publicJwk,
      kid: TEST_ACCESS_KID,
      alg: "RS256",
      use: "sig",
    },
  };
}

export async function signAccessJwt(
  privateKey: CryptoKey,
  claims: Record<string, unknown>,
): Promise<string> {
  const header = { alg: "RS256", kid: TEST_ACCESS_KID, typ: "JWT" };
  const encodedHeader = base64UrlJson(header);
  const encodedPayload = base64UrlJson(claims);
  const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, data));
  return `${encodedHeader}.${encodedPayload}.${bytesToBase64Url(signature)}`;
}

export function validAccessClaims(email: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    aud: [TEST_ACCESS_AUD],
    email,
    iss: `https://${TEST_ACCESS_TEAM}`,
    exp: now + 3600,
    iat: now,
    nbf: now - 10,
    type: "app",
    sub: "access-test-sub",
    ...overrides,
  };
}

export function mockJwksResponse(publicJwk: JsonWebKey): Response {
  return new Response(JSON.stringify({ keys: [publicJwk] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function base64UrlJson(value: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const byte of bytes) {
    bin += String.fromCharCode(byte);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
