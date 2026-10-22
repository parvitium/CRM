import { createMiddleware } from "hono/factory";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { loadActorFromAccess } from "../auth/access";
import {
  clearSessionCookies,
  createSession,
  destroySession,
  loadActorFromCookie,
  sessionCookie,
} from "../auth/session";
import { timingSafeEqual } from "../auth/crypto";
import { AuthzError } from "../domain/authz";
import { HttpError, wantsJson } from "../domain/http";
import { applySecurityHeaders } from "./security";
import type { Context } from "hono";
import type { AppEnv } from "../app-env";

export function isHealthPath(path: string): boolean {
  return path === "/health" || path === "/health/";
}

export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  // Health is public and must never mint or bind a session, even if Access headers are present.
  if (isHealthPath(c.req.path)) {
    c.set("actor", null);
    c.set("csrfToken", null);
    c.set("sessionId", null);
    await next();
    return;
  }

  const accessActor = await loadActorFromAccess(c.env.DB, c.req.raw, c.env);
  const cookieSession = await loadActorFromCookie(c.env.DB, c.req.header("Cookie") ?? null);

  if (accessActor && !cookieSession) {
    const created = await createSession(c.env.DB, accessActor.id);
    c.header("Set-Cookie", sessionCookie(created.rawToken, c.req.url));
    c.set("actor", accessActor);
    c.set("csrfToken", created.csrfToken);
    c.set("sessionId", created.sessionId);
  } else if (cookieSession) {
    if (accessActor && accessActor.id !== cookieSession.actor.id) {
      throw new HttpError(403, "Access identity does not match session");
    }
    c.set("actor", cookieSession.actor);
    c.set("csrfToken", cookieSession.csrfToken);
    c.set("sessionId", cookieSession.sessionId);
  } else {
    c.set("actor", null);
    c.set("csrfToken", null);
    c.set("sessionId", null);
  }

  await next();
});

export const csrfMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  if (c.req.method === "GET" || c.req.method === "HEAD" || c.req.method === "OPTIONS") {
    await next();
    return;
  }
  if (
    c.req.path === "/auth/magic" ||
    c.req.path === "/auth/magic/consume" ||
    c.req.path === "/auth/dev-login"
  ) {
    await next();
    return;
  }

  const expected = c.get("csrfToken");
  if (!expected) {
    throw new HttpError(403, "Missing session for this action");
  }

  let provided = c.req.header("X-CSRF-Token") ?? "";
  if (!provided) {
    const contentType = c.req.header("Content-Type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await c.req.json().catch(() => ({}))) as { csrf?: string };
      provided = body.csrf ?? "";
      c.set("jsonBody", body);
    } else {
      const form = await c.req.parseBody();
      provided = typeof form.csrf === "string" ? form.csrf : "";
      c.set("formBody", form);
    }
  }

  if (!timingSafeEqual(provided, expected)) {
    throw new HttpError(403, "Invalid CSRF token");
  }
  await next();
});

export function handleError(err: unknown, c: Context<AppEnv>): Response {
  const status =
    err instanceof AuthzError || err instanceof HttpError ? err.status : 500;
  const message =
    err instanceof AuthzError || err instanceof HttpError ? err.message : "Something went wrong";
  if (status >= 500) {
    console.error(JSON.stringify({ msg: "unhandled", error: String(err) }));
  }
  const code = status as ContentfulStatusCode;
  let res: Response;
  if (wantsJson(c.req.raw) || c.req.path.startsWith("/api/")) {
    res = c.json({ error: message }, code);
  } else if (status === 401) {
    res = c.redirect("/login");
  } else {
    res = c.html(
      `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/styles.css"><title>Error</title></head><body class="page"><p class="banner bad">${escapeHtml(message)}</p><p><a href="/">Back</a></p></body></html>`,
      code,
    );
  }
  applySecurityHeaders(res.headers, c.req.url, c.req.path);
  return res;
}

export async function signOut(c: {
  env: Env;
  req: { url: string };
  get: (k: "sessionId") => string | null;
}): Promise<string[]> {
  const sessionId = c.get("sessionId");
  if (sessionId) {
    await destroySession(c.env.DB, sessionId);
  }
  return clearSessionCookies();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
