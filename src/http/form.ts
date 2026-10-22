import type { Context } from "hono";
import type { AppEnv } from "../app-env";

export async function readForm(c: Context<AppEnv>): Promise<Record<string, string>> {
  const stored = c.get("formBody");
  if (stored) {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(stored)) {
      if (typeof value === "string") {
        out[key] = value;
      }
    }
    return out;
  }
  const parsed = await c.req.parseBody();
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") {
      out[key] = value;
    }
  }
  return out;
}

export async function readJson<T extends Record<string, unknown>>(c: Context<AppEnv>): Promise<T> {
  const stored = c.get("jsonBody");
  if (stored) {
    return stored as T;
  }
  return (await c.req.json<T>().catch(() => ({} as T))) as T;
}

export function noticeFromQuery(c: Context<AppEnv>): { notice?: string; error?: string } {
  const notice = c.req.query("notice");
  const error = c.req.query("error");
  return {
    notice: notice ? notice : undefined,
    error: error ? error : undefined,
  };
}
