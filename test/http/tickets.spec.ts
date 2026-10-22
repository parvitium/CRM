import { beforeAll, describe, expect, it } from "vitest";
import { EMAILS } from "../../src/ids";
import { json, login, seedSql } from "../helpers";

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
});
