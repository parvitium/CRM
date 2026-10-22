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

export async function login(email: string): Promise<{ cookie: string; csrf: string }> {
  const res = await workerFetch("https://crm.test/auth/dev-login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email }).toString(),
    redirect: "manual",
  });
  const cookie = readSetCookie(res);
  if (!cookie) {
    throw new Error(`dev login failed for ${email}: ${res.status}`);
  }
  const me = await workerFetch("https://crm.test/api/me", {
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

/** Fetch through a fresh app with selected env overrides (e.g. AUTH_MODE=access). */
export function workerFetchWithEnv(
  input: string,
  init: RequestInit | undefined,
  overrides: Record<string, string>,
): Promise<Response> {
  const app = createApp();
  const patched = new Proxy(env, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && Object.hasOwn(overrides, prop)) {
        return overrides[prop];
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  return app.fetch(new Request(input, init), patched);
}

export function hiddenInput(html: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`name="${escaped}" value="([^"]*)"`));
  return match?.[1] ?? null;
}

export async function issueMagicToken(email: string): Promise<string> {
  await workerFetch("https://crm.test/auth/magic", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email }).toString(),
  });
  const mailed = await env.DB.prepare(
    "SELECT body FROM outbound_emails WHERE to_email = ? ORDER BY created_at DESC LIMIT 1",
  )
    .bind(email)
    .first<{ body: string }>();
  const match = mailed?.body.match(/https?:\/\/[^ ]+\/auth\/magic\?token=([a-f0-9]+)/);
  if (!match?.[1]) {
    throw new Error(`no magic token emailed to ${email}`);
  }
  return match[1];
}

export async function openMagicConfirm(
  token: string,
): Promise<{ status: number; html: string; csrf: string | null; cookie: string | null; setCookie: string | null }> {
  const res = await workerFetch(`https://crm.test/auth/magic?token=${token}`, {
    redirect: "manual",
  });
  const html = await res.text();
  return {
    status: res.status,
    html,
    csrf: hiddenInput(html, "csrf"),
    cookie: readSetCookie(res),
    setCookie: res.headers.get("Set-Cookie"),
  };
}

export function consumeMagic(
  token: string,
  csrf: string,
  cookie: string,
): Promise<Response> {
  return workerFetch("https://crm.test/auth/magic/consume", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie,
    },
    body: new URLSearchParams({ token, csrf }).toString(),
    redirect: "manual",
  });
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
  const res = await workerFetch(`https://crm.test${path}`, {
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
