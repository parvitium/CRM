import { env, exports } from "cloudflare:workers";
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
