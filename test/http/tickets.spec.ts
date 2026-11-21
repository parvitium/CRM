import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { commitTicketWrite, createTicket, getTicket, transitionTicket } from "../../src/db/queries";
import { EMAILS, USER_IDS } from "../../src/ids";
import { hiddenInput, json, localUrl, login, seedSql, workerFetch } from "../helpers";

describe("ticket workflow", () => {
  beforeAll(async () => {
    await seedSql();
  });

  it("creates a ticket and walks QA fail back to in-dev", async () => {
    const adam = await login(EMAILS.adam);
    const created = await json<{ id: string }>("/api/admin/tickets", {
      cookie: adam.cookie,
      csrf: adam.csrf,
      method: "POST",
      body: { title: "QA fail path", type: "dev" },
    });
    expect(created.status).toBe(201);
    const id = created.body.id;

    for (const to of ["ready", "in-dev", "in-qa"] as const) {
      const moved = await json<{ ticket: { stage: string } }>(`/api/admin/tickets/${id}/transition`, {
        cookie: adam.cookie,
        csrf: adam.csrf,
        method: "POST",
        body: { to },
      });
      expect(moved.status).toBe(200);
      expect(moved.body.ticket.stage).toBe(to);
    }

    const failed = await json<{ ticket: { stage: string; qa_result: string } }>(
      `/api/admin/tickets/${id}/qa`,
      {
        cookie: adam.cookie,
        csrf: adam.csrf,
        method: "POST",
        body: { result: "fail", notes: "Broken heading" },
      },
    );
    expect(failed.status).toBe(200);
    expect(failed.body.ticket.stage).toBe("in-dev");
    expect(failed.body.ticket.qa_result).toBe("fail");
  });

  it("sends a QA pass to needs-adam", async () => {
    const adam = await login(EMAILS.adam);
    const created = await json<{ id: string }>("/api/admin/tickets", {
      cookie: adam.cookie,
      csrf: adam.csrf,
      method: "POST",
      body: { title: "QA pass path", type: "task" },
    });
    const id = created.body.id;
    for (const to of ["ready", "in-dev", "in-qa"] as const) {
      await json(`/api/admin/tickets/${id}/transition`, {
        cookie: adam.cookie,
        csrf: adam.csrf,
        method: "POST",
        body: { to },
      });
    }
    const passed = await json<{ ticket: { stage: string; qa_result: string } }>(
      `/api/admin/tickets/${id}/qa`,
      {
        cookie: adam.cookie,
        csrf: adam.csrf,
        method: "POST",
        body: { result: "pass" },
      },
    );
    expect(passed.body.ticket.stage).toBe("needs-adam");
    expect(passed.body.ticket.qa_result).toBe("pass");
  });

  it("rejects leaving in-qa through the ordinary transition endpoint", async () => {
    const adam = await login(EMAILS.adam);
    const created = await json<{ id: string }>("/api/admin/tickets", {
      cookie: adam.cookie,
      csrf: adam.csrf,
      method: "POST",
      body: { title: "QA bypass attempt", type: "task" },
    });
    const id = created.body.id;
    for (const to of ["ready", "in-dev", "in-qa"] as const) {
      const moved = await json(`/api/admin/tickets/${id}/transition`, {
        cookie: adam.cookie,
        csrf: adam.csrf,
        method: "POST",
        body: { to },
      });
      expect(moved.status).toBe(200);
    }

    const bypass = await json<{ error?: string; ticket?: { stage: string; qa_result: string | null } }>(
      `/api/admin/tickets/${id}/transition`,
      {
        cookie: adam.cookie,
        csrf: adam.csrf,
        method: "POST",
        body: { to: "needs-adam" },
      },
    );
    expect(bypass.status).toBe(400);
    expect(bypass.body.error).toMatch(/QA/);

    const current = await json<{ ticket: { stage: string; qa_by: string | null; qa_result: string | null; qa_date: string | null } }>(
      `/api/admin/tickets/${id}`,
      { cookie: adam.cookie },
    );
    expect(current.body.ticket.stage).toBe("in-qa");
    expect(current.body.ticket.qa_by).toBeNull();
    expect(current.body.ticket.qa_result).toBeNull();
    expect(current.body.ticket.qa_date).toBeNull();
  });

  it("rejects an illegal skip from backlog to closed", async () => {
    const adam = await login(EMAILS.adam);
    const created = await json<{ id: string }>("/api/admin/tickets", {
      cookie: adam.cookie,
      csrf: adam.csrf,
      method: "POST",
      body: { title: "Skip attempt", type: "task" },
    });
    const skipped = await json<{ error?: string }>(
      `/api/admin/tickets/${created.body.id}/transition`,
      {
        cookie: adam.cookie,
        csrf: adam.csrf,
        method: "POST",
        body: { to: "closed" },
      },
    );
    expect(skipped.status).toBe(400);
    expect(skipped.body.error).toMatch(/Cannot move/);
  });

  it("writes ticket create and history in one D1 batch and rolls back together", async () => {
    const batches: number[] = [];
    const db = new Proxy(env.DB, {
      get(target, prop, receiver) {
        if (prop === "batch") {
          return (statements: D1PreparedStatement[]) => {
            batches.push(statements.length);
            return target.batch(statements);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as D1Database;

    const id = await createTicket(db, {
      title: "Atomic create",
      type: "task",
      actorUserId: USER_IDS.adam,
    });
    expect(batches).toEqual([2]);
    const history = await env.DB.prepare("SELECT COUNT(*) AS n FROM ticket_history WHERE ticket_id = ?")
      .bind(id)
      .first<{ n: number }>();
    expect(history?.n).toBe(1);

    const title = `orphan-${crypto.randomUUID()}`;
    await expect(
      createTicket(env.DB, {
        title,
        type: "task",
        actorUserId: "00000000-0000-4000-8000-000000000099",
      }),
    ).rejects.toThrow();
    const leftover = await env.DB.prepare("SELECT id FROM tickets WHERE title = ?").bind(title).first();
    expect(leftover).toBeNull();
  });

  it("rolls back a stage change when the history insert fails", async () => {
    const id = await createTicket(env.DB, {
      title: "Atomic transition",
      type: "task",
      actorUserId: USER_IDS.adam,
    });
    await expect(
      transitionTicket(env.DB, {
        ticketId: id,
        to: "ready",
        actorUserId: "00000000-0000-4000-8000-000000000099",
      }),
    ).rejects.toThrow();
    const ticket = await getTicket(env.DB, id);
    expect(ticket?.stage).toBe("backlog");
    const history = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM ticket_history WHERE ticket_id = ? AND to_stage = 'ready'",
    )
      .bind(id)
      .first<{ n: number }>();
    expect(history?.n).toBe(0);
  });

  it("uses D1 batch for a two-statement ticket write helper", async () => {
    let seen = 0;
    const db = new Proxy(env.DB, {
      get(target, prop, receiver) {
        if (prop === "batch") {
          return (statements: D1PreparedStatement[]) => {
            seen = statements.length;
            return target.batch(statements);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as D1Database;
    await commitTicketWrite(db, [
      env.DB.prepare("SELECT 1"),
      env.DB.prepare("SELECT 2"),
    ]);
    expect(seen).toBe(2);
  });

  it("keeps board Go on the board at the destination column", async () => {
    const adam = await login(EMAILS.adam);
    const created = await json<{ id: string }>("/api/admin/tickets", {
      cookie: adam.cookie,
      csrf: adam.csrf,
      method: "POST",
      body: { title: "Board stay put", type: "task" },
    });
    const board = await workerFetch(localUrl("/admin/tickets"), {
      headers: { Cookie: adam.cookie },
    });
    const html = await board.text();
    expect(board.status).toBe(200);
    expect(html).toMatch(/id="backlog"/);
    expect(html).toMatch(/id="in-dev"/);
    expect(html).toContain(`action="/admin/tickets/${created.body.id}/transition"`);
    expect(html).toContain('name="return_to" value="board"');
    expect(html).toContain(`aria-label="Go, move Board stay put"`);
    expect(html).toContain(`<span class="visually-hidden">Move Board stay put to</span>`);

    const moved = await workerFetch(localUrl(`/admin/tickets/${created.body.id}/transition`), {
      method: "POST",
      headers: {
        Cookie: adam.cookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ csrf: adam.csrf, to: "ready", return_to: "board" }).toString(),
      redirect: "manual",
    });
    expect(moved.status).toBe(302);
    expect(moved.headers.get("Location")).toMatch(/\/admin\/tickets\?notice=Moved#ready$/);

    const detail = await workerFetch(localUrl(`/admin/tickets/${created.body.id}`), {
      headers: { Cookie: adam.cookie },
    });
    const detailHtml = await detail.text();
    expect(hiddenInput(detailHtml, "return_to")).toBeNull();
  });
});
