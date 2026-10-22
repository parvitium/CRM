import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { EMAILS } from "../../src/ids";
import { json, login, seedSql, workerFetch } from "../helpers";

describe("auth", () => {
  beforeAll(async () => {
    await seedSql();
  });

  it("issues a magic link without revealing whether the email exists", async () => {
    const known = await workerFetch("https://crm.test/auth/magic", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: EMAILS.adam }).toString(),
      redirect: "manual",
    });
    const unknown = await workerFetch("https://crm.test/auth/magic", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: "nobody@example.test" }).toString(),
      redirect: "manual",
    });
    expect(known.status).toBe(302);
    expect(unknown.status).toBe(302);
    expect(known.headers.get("Location")).toBe(unknown.headers.get("Location"));

    const mailed = await env.DB.prepare(
      "SELECT body FROM outbound_emails WHERE to_email = ? ORDER BY created_at DESC LIMIT 1",
    )
      .bind(EMAILS.adam)
      .first<{ body: string }>();
    expect(mailed?.body).toMatch(/\/auth\/magic\?token=/);

    const none = await env.DB.prepare("SELECT COUNT(*) AS n FROM outbound_emails WHERE to_email = ?")
      .bind("nobody@example.test")
      .first<{ n: number }>();
    expect(none?.n).toBe(0);
  });

  it("signs the admin in via the emailed token", async () => {
    await workerFetch("https://crm.test/auth/magic", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: EMAILS.lakeview }).toString(),
    });
    const mailed = await env.DB.prepare(
      "SELECT body FROM outbound_emails WHERE to_email = ? ORDER BY created_at DESC LIMIT 1",
    )
      .bind(EMAILS.lakeview)
      .first<{ body: string }>();
    const match = mailed?.body.match(/https?:\/\/[^ ]+\/auth\/magic\?token=([a-f0-9]+)/);
    expect(match?.[1]).toBeTruthy();
    const consume = await workerFetch(`https://crm.test/auth/magic?token=${match?.[1]}`, {
      redirect: "manual",
    });
    expect(consume.status).toBe(302);
    expect(consume.headers.get("Location")).toMatch(/\/portal$/);
    expect(consume.headers.get("Set-Cookie")).toMatch(/pv_session=/);
    expect(consume.headers.get("Set-Cookie")).toMatch(/HttpOnly/);
  });

  it("maps a Cloudflare Access email header to the user", async () => {
    const res = await json<{ email: string; role: string }>("/api/me", {
      cookie: undefined,
    });
    // no header → unauthorized
    expect(res.status).toBe(401);

    const access = await workerFetch("https://crm.test/api/me", {
      headers: {
        Accept: "application/json",
        "Cf-Access-Authenticated-User-Email": EMAILS.adam,
      },
    });
    expect(access.status).toBe(200);
    const body = (await access.json()) as { email: string; role: string };
    expect(body.email).toBe(EMAILS.adam);
    expect(body.role).toBe("admin");
  });

  it("rejects a CSRF-less POST after login", async () => {
    const adam = await login(EMAILS.adam);
    const res = await workerFetch("https://crm.test/api/admin/tickets", {
      method: "POST",
      headers: {
        Cookie: adam.cookie,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "no csrf", type: "task" }),
    });
    expect(res.status).toBe(403);
  });
});
