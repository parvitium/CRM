import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../app-env";

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'none'",
  "style-src 'self'",
  "img-src 'self' data:",
].join("; ");

export const HSTS_VALUE = "max-age=31536000; includeSubDomains";

export function referrerPolicyFor(path: string): string {
  return path.startsWith("/auth/magic") ? "no-referrer" : "strict-origin-when-cross-origin";
}

export function applySecurityHeaders(headers: Headers, requestUrl: string, path: string): void {
  headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", referrerPolicyFor(path));
  if (new URL(requestUrl).protocol === "https:") {
    headers.set("Strict-Transport-Security", HSTS_VALUE);
  } else {
    headers.delete("Strict-Transport-Security");
  }
}

/**
 * Workers Assets (`env.ASSETS.fetch`) returns a Response whose headers are
 * immutable. Recreate before mutating so CSP / nosniff / frame denial can be
 * applied without `TypeError: Can't modify immutable headers.`
 */
export function mutableResponse(res: Response): Response {
  return new Response(res.body, res);
}

export const securityHeaders = createMiddleware<AppEnv>(async (c, next) => {
  try {
    await next();
  } finally {
    const res = mutableResponse(c.res);
    applySecurityHeaders(res.headers, c.req.url, c.req.path);
    c.res = res;
  }
});
