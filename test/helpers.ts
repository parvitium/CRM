import { env, exports } from "cloudflare:workers";
import { createApp } from "../src/app";
import { EMAILS } from "../src/ids";

export async function seedSql(): Promise<void> {
  const already = await env.DB.prepare("SELECT COUNT(*) AS n FROM customers").first<{ n: number }>();
  if ((already?.n ?? 0) > 0) {
    return;
  }
  const withoutComments = env.TEST_SEED.split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith("--");
    })
    .join("\n");
  await env.DB.batch(splitSql(withoutComments).map((statement) => env.DB.prepare(statement)));
}

function splitSql(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inQuote = false;
  for (const ch of sql) {
    if (ch === "'") {
      inQuote = !inQuote;
      current += ch;
      continue;
    }
    if (ch === ";" && !inQuote) {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = "";
      continue;
    }
    current += ch;
  }
  const trailing = current.trim();
  if (trailing) {
    statements.push(trailing);
  }
  return statements;
}

/**
 * Cookie /dev-login only works on loopback with AUTH_MODE=dev.
 * https://crm.test is treated as production (Access, fail closed).
 */
export const LOCAL_ORIGIN = "http://127.0.0.1:8787";
export const LOCAL_HTTPS_ORIGIN = "https://localhost";

export function localUrl(path: string, origin = LOCAL_ORIGIN): string {
  return `${origin}${path}`;
}

export async function login(email: string): Promise<{ cookie: string; csrf: string }> {
  const res = await workerFetch(localUrl("/auth/dev-login"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email }).toString(),
    redirect: "manual",
  });
  const cookie = readSetCookie(res);
  if (!cookie) {
    throw new Error(`dev login failed for ${email}: ${res.status}`);
  }
  const me = await workerFetch(localUrl("/api/me"), {
    headers: { Cookie: cookie, Accept: "application/json" },
  });
  const body = (await me.json()) as { csrf?: string };
  if (!body.csrf) {
    throw new Error("missing csrf after login");
  }
  return { cookie, csrf: body.csrf };
}

export function workerFetch(input: string, init?: RequestInit): Promise<Response> {
  return exports.default.fetch(new Request(input, init));
}

/** Fetch through a fresh app with selected env overrides (e.g. Access team + AUD). */
export function workerFetchWithEnv(
  input: string,
  init: RequestInit | undefined,
  overrides: Record<string, unknown>,
): Promise<Response> {
  const app = createApp();
  const patched = new Proxy(env, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && Object.hasOwn(overrides, prop)) {
        return overrides[prop];
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as Env;
  return app.fetch(new Request(input, init), patched);
}

/** Simulate Workers Assets: readable body, headers that throw on mutate. */
export function immutableAssetResponse(body: string, contentType: string): Response {
  const res = new Response(body, {
    status: 200,
    headers: { "Content-Type": contentType },
  });
  const fail = () => {
    throw new TypeError("Can't modify immutable headers.");
  };
  for (const method of ["set", "append", "delete"] as const) {
    Object.defineProperty(res.headers, method, { configurable: true, value: fail });
  }
  return res;
}

export function mockAssetsFetcher(files: Record<string, { body: string; contentType: string }>): Fetcher {
  return {
    fetch(input: RequestInfo | URL) {
      const url = input instanceof Request ? input.url : String(input);
      const path = new URL(url, "https://assets.test").pathname;
      const file = files[path];
      if (!file) {
        return Promise.resolve(new Response("Not found", { status: 404 }));
      }
      return Promise.resolve(immutableAssetResponse(file.body, file.contentType));
    },
  } as Fetcher;
}

export function hiddenInput(html: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`name="${escaped}" value="([^"]*)"`));
  return match?.[1] ?? null;
}

export function getSetCookies(res: Response): string[] {
  if (typeof res.headers.getSetCookie === "function") {
    return res.headers.getSetCookie();
  }
  const single = res.headers.get("Set-Cookie");
  return single ? [single] : [];
}

export function cookieHeaderFromResponse(res: Response): string {
  return getSetCookies(res)
    .map((part) => part.split(";", 1)[0] ?? "")
    .filter(Boolean)
    .join("; ");
}

export function readSetCookie(res: Response): string | null {
  const header = res.headers.get("Set-Cookie");
  if (!header) {
    return null;
  }
  return header.split(";", 1)[0] ?? null;
}

export async function json<T>(
  path: string,
  opts: { cookie?: string; method?: string; body?: unknown; csrf?: string } = {},
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.cookie) {
    headers.Cookie = opts.cookie;
  }
  if (opts.csrf) {
    headers["X-CSRF-Token"] = opts.csrf;
  }
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const res = await workerFetch(localUrl(path), {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify({ ...opts.body, csrf: opts.csrf }),
  });
  const text = await res.text();
  let body: T;
  try {
    body = JSON.parse(text) as T;
  } catch {
    body = { error: text } as T;
  }
  return { status: res.status, body };
}

export { EMAILS };
