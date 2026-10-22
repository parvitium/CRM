import { describe, expect, it } from "vitest";
import {
  DEV_SESSION_COOKIE,
  HOST_SESSION_COOKIE,
  clearSessionCookies,
  sessionCookie,
  sessionCookieName,
} from "../../src/auth/session";

function cookieFlags(header: string): string[] {
  return header
    .split(";")
    .slice(1)
    .map((part) => part.trim())
    .filter(Boolean);
}

describe("session cookies", () => {
  it("uses __Host- on HTTPS with Secure, Path=/, HttpOnly, SameSite=Lax, and no Domain", () => {
    expect(sessionCookieName("https://crm.parvitium.example/admin")).toBe(HOST_SESSION_COOKIE);
    const cookie = sessionCookie("tok", "https://crm.parvitium.example/login");
    expect(cookie.startsWith(`${HOST_SESSION_COOKIE}=tok;`)).toBe(true);
    expect(cookieFlags(cookie)).toEqual(
      expect.arrayContaining(["Path=/", "HttpOnly", "SameSite=Lax", "Secure"]),
    );
    expect(cookie).not.toMatch(/Domain=/i);
  });

  it("falls back to pv_session without Secure on HTTP so local wrangler dev works", () => {
    expect(sessionCookieName("http://127.0.0.1:8787/login")).toBe(DEV_SESSION_COOKIE);
    const cookie = sessionCookie("tok", "http://127.0.0.1:8787/login");
    expect(cookie.startsWith(`${DEV_SESSION_COOKIE}=tok;`)).toBe(true);
    expect(cookie).not.toContain("__Host-");
    expect(cookieFlags(cookie)).toEqual(expect.arrayContaining(["Path=/", "HttpOnly", "SameSite=Lax"]));
    expect(cookieFlags(cookie)).not.toContain("Secure");
    expect(cookie).not.toMatch(/Domain=/i);
  });

  it("clears both cookie names on logout", () => {
    const cleared = clearSessionCookies();
    expect(cleared).toHaveLength(2);
    expect(cleared[0]).toMatch(new RegExp(`^${DEV_SESSION_COOKIE}=;`));
    expect(cleared[1]).toMatch(new RegExp(`^${HOST_SESSION_COOKIE}=;`));
    expect(cleared[1]).toMatch(/Secure/);
    expect(cleared[1]).toMatch(/Path=\//);
    expect(cleared[1]).not.toMatch(/Domain=/i);
  });
});
