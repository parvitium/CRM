import { Hono } from "hono";
import type { AppEnv } from "../app-env";
import { requireAdmin, requireUser } from "../domain/authz";
import { HttpError } from "../domain/http";
import { isQaResult, isTicketStage, isTicketType } from "../domain/tickets";
import { readJson } from "../http/form";
import {
  createTicket,
  getCustomer,
  getTicket,
  listCustomers,
  listOpenFlags,
  listTickets,
  submitQa,
  transitionTicket,
} from "../db/queries";

export const apiRoutes = new Hono<AppEnv>();

apiRoutes.get("/me", (c) => {
  const actor = requireUser(c.get("actor"));
  return c.json({
    id: actor.id,
    email: actor.email,
    displayName: actor.displayName,
    role: actor.role,
    csrf: c.get("csrfToken"),
  });
});

apiRoutes.get("/admin/customers", async (c) => {
  requireAdmin(c.get("actor"));
  const customers = await listCustomers(c.env.DB, c.req.query("kind"));
  return c.json({ customers: customers.results });
});

apiRoutes.get("/admin/customers/:id", async (c) => {
  requireAdmin(c.get("actor"));
  const customer = await getCustomer(c.env.DB, c.req.param("id"));
  if (!customer) {
    throw new HttpError(404, "Customer not found");
  }
  return c.json({ customer });
});

apiRoutes.get("/admin/flags", async (c) => {
  requireAdmin(c.get("actor"));
  const flags = await listOpenFlags(c.env.DB);
  return c.json({ flags: flags.results });
});

apiRoutes.get("/admin/tickets", async (c) => {
  requireAdmin(c.get("actor"));
  const tickets = await listTickets(c.env.DB);
  return c.json({ tickets: tickets.results });
});

apiRoutes.post("/admin/tickets", async (c) => {
  const actor = requireAdmin(c.get("actor"));
  const body = await readJson<{
    title?: string;
    description?: string;
    type?: string;
    customerId?: string | null;
  }>(c);
  const type = body.type ?? "task";
  if (!isTicketType(type)) {
    throw new HttpError(400, "Invalid ticket type");
  }
  const id = await createTicket(c.env.DB, {
    title: body.title ?? "Untitled",
    description: body.description,
    type,
    customerId: body.customerId ?? null,
    actorUserId: actor.id,
  });
  return c.json({ id }, 201);
});

apiRoutes.post("/admin/tickets/:id/transition", async (c) => {
  const actor = requireAdmin(c.get("actor"));
  const body = await readJson<{ to?: string; note?: string }>(c);
  const to = body.to ?? "";
  if (!isTicketStage(to)) {
    throw new HttpError(400, "Invalid stage");
  }
  try {
    const ticket = await transitionTicket(c.env.DB, {
      ticketId: c.req.param("id"),
      to,
      actorUserId: actor.id,
      note: body.note,
    });
    return c.json({ ticket });
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : "Move failed");
  }
});

apiRoutes.post("/admin/tickets/:id/qa", async (c) => {
  const actor = requireAdmin(c.get("actor"));
  const body = await readJson<{ result?: string; notes?: string }>(c);
  const result = body.result ?? "";
  if (!isQaResult(result)) {
    throw new HttpError(400, "Invalid QA result");
  }
  try {
    const ticket = await submitQa(c.env.DB, {
      ticketId: c.req.param("id"),
      result,
      actorUserId: actor.id,
      notes: body.notes,
    });
    return c.json({ ticket });
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : "QA failed");
  }
});

apiRoutes.get("/admin/tickets/:id", async (c) => {
  requireAdmin(c.get("actor"));
  const ticket = await getTicket(c.env.DB, c.req.param("id"));
  if (!ticket) {
    throw new HttpError(404, "Ticket not found");
  }
  return c.json({ ticket });
});
