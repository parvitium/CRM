import { Hono } from "hono";
import type { AppEnv } from "../app-env";
import { requireAdmin } from "../domain/authz";
import { HttpError } from "../domain/http";
import { isQaResult, isTicketStage, isTicketType } from "../domain/tickets";
import { readForm, noticeFromQuery } from "../http/form";
import {
  createCustomer,
  createMessage,
  createTicket,
  dashboardCounts,
  getCustomer,
  getGbp,
  getSubscriptionForCustomer,
  getTicket,
  listCalls,
  callStats,
  listCustomers,
  listDevHistory,
  listMessages,
  listOpenFlags,
  listPackages,
  listPayments,
  listReviews,
  listSeo,
  listSocialAccounts,
  listTemplates,
  listTicketHistory,
  listTickets,
  listWebsites,
  resolveFlag,
  submitQa,
  transitionTicket,
} from "../db/queries";
import {
  AdminHome,
  CustomerDetailPage,
  CustomerListPage,
  FlagsPage,
  HistoryPage,
  TemplatesPage,
  TicketBoardPage,
  TicketDetailPage,
} from "../views/admin";

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use("*", async (c, next) => {
  requireAdmin(c.get("actor"));
  await next();
});

adminRoutes.get("/", async (c) => {
  const actor = requireAdmin(c.get("actor"));
  const [counts, flags] = await Promise.all([
    dashboardCounts(c.env.DB),
    listOpenFlags(c.env.DB),
  ]);
  return c.html(
    AdminHome({
      actor,
      path: "/admin",
      csrf: c.get("csrfToken") ?? "",
      notice: noticeFromQuery(c).notice,
      counts,
      flags: flags.results,
    }),
  );
});

adminRoutes.get("/customers", async (c) => {
  const actor = requireAdmin(c.get("actor"));
  const [customers, packages] = await Promise.all([
    listCustomers(c.env.DB),
    listPackages(c.env.DB),
  ]);
  return c.html(
    CustomerListPage({
      actor,
      path: "/admin/customers",
      csrf: c.get("csrfToken") ?? "",
      notice: noticeFromQuery(c).notice,
      customers: customers.results,
      packages: packages.results,
    }),
  );
});

adminRoutes.post("/customers", async (c) => {
  const form = await readForm(c);
  let id: string;
  try {
    id = await createCustomer(c.env.DB, {
      businessName: form.business_name ?? "",
      contactName: form.contact_name ?? "",
      contactEmail: form.contact_email ?? "",
      phone: form.phone,
      city: form.city,
      packageId: form.package_id || undefined,
    });
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : "Could not save customer");
  }
  return c.redirect(`/admin/customers/${id}?notice=Customer+saved`);
});

adminRoutes.get("/customers/:id", async (c) => {
  const actor = requireAdmin(c.get("actor"));
  const id = c.req.param("id");
  const customer = await getCustomer(c.env.DB, id);
  if (!customer) {
    throw new HttpError(404, "Customer not found");
  }
  const [subscription, payments, websites, social, gbp, seo, calls, stats, reviews, messages, tickets] =
    await Promise.all([
      getSubscriptionForCustomer(c.env.DB, id),
      listPayments(c.env.DB, id),
      listWebsites(c.env.DB, id),
      listSocialAccounts(c.env.DB, id),
      getGbp(c.env.DB, id),
      listSeo(c.env.DB, id),
      listCalls(c.env.DB, id),
      callStats(c.env.DB, id),
      listReviews(c.env.DB, id),
      listMessages(c.env.DB, id),
      listTickets(c.env.DB, id),
    ]);
  return c.html(
    CustomerDetailPage({
      actor,
      path: `/admin/customers/${id}`,
      csrf: c.get("csrfToken") ?? "",
      customer,
      subscription,
      payments: payments.results,
      websites: websites.results,
      social: social.results,
      gbp,
      seo: seo.results,
      calls: calls.results,
      callStats: stats,
      reviews: reviews.results,
      messages: messages.results,
      tickets: tickets.results,
    }),
  );
});

adminRoutes.post("/customers/:id/messages", async (c) => {
  const form = await readForm(c);
  await createMessage(c.env.DB, {
    customerId: c.req.param("id"),
    fromRole: "admin",
    subject: form.subject ?? "Update",
    body: form.body ?? "",
  });
  return c.redirect(`/admin/customers/${c.req.param("id")}?notice=Message+sent`);
});

adminRoutes.get("/flags", async (c) => {
  const actor = requireAdmin(c.get("actor"));
  const flags = await listOpenFlags(c.env.DB);
  return c.html(
    FlagsPage({
      actor,
      path: "/admin/flags",
      csrf: c.get("csrfToken") ?? "",
      flags: flags.results,
    }),
  );
});

adminRoutes.post("/flags/:id/resolve", async (c) => {
  await resolveFlag(c.env.DB, c.req.param("id"));
  return c.redirect("/admin/flags?notice=Resolved");
});

adminRoutes.get("/tickets", async (c) => {
  const actor = requireAdmin(c.get("actor"));
  const [tickets, customers] = await Promise.all([
    listTickets(c.env.DB),
    listCustomers(c.env.DB),
  ]);
  return c.html(
    TicketBoardPage({
      actor,
      path: "/admin/tickets",
      csrf: c.get("csrfToken") ?? "",
      notice: noticeFromQuery(c).notice,
      tickets: tickets.results,
      customers: customers.results.map((row) => ({
        id: String(row.id),
        business_name: String(row.business_name),
      })),
    }),
  );
});

adminRoutes.post("/tickets", async (c) => {
  const actor = requireAdmin(c.get("actor"));
  const form = await readForm(c);
  const type = form.type ?? "task";
  if (!isTicketType(type)) {
    throw new HttpError(400, "Invalid ticket type");
  }
  await createTicket(c.env.DB, {
    title: form.title ?? "Untitled",
    description: form.description,
    type,
    customerId: form.customer_id || null,
    actorUserId: actor.id,
  });
  return c.redirect("/admin/tickets?notice=Ticket+added");
});

adminRoutes.get("/tickets/:id", async (c) => {
  const actor = requireAdmin(c.get("actor"));
  const ticket = await getTicket(c.env.DB, c.req.param("id"));
  if (!ticket) {
    throw new HttpError(404, "Ticket not found");
  }
  const history = await listTicketHistory(c.env.DB, ticket.id);
  return c.html(
    TicketDetailPage({
      actor,
      path: `/admin/tickets/${ticket.id}`,
      csrf: c.get("csrfToken") ?? "",
      ticket,
      history: history.results,
      error: noticeFromQuery(c).error,
    }),
  );
});

adminRoutes.post("/tickets/:id/transition", async (c) => {
  const actor = requireAdmin(c.get("actor"));
  const form = await readForm(c);
  const to = form.to ?? "";
  if (!isTicketStage(to)) {
    throw new HttpError(400, "Invalid stage");
  }
  try {
    await transitionTicket(c.env.DB, {
      ticketId: c.req.param("id"),
      to,
      actorUserId: actor.id,
      note: form.note,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Move failed";
    if (form.return_to === "board") {
      return c.redirect(`/admin/tickets?error=${encodeURIComponent(message)}`);
    }
    return c.redirect(`/admin/tickets/${c.req.param("id")}?error=${encodeURIComponent(message)}`);
  }
  if (form.return_to === "board") {
    return c.redirect(`/admin/tickets?notice=Moved#${encodeURIComponent(to)}`);
  }
  return c.redirect(`/admin/tickets/${c.req.param("id")}?notice=Moved`);
});

adminRoutes.post("/tickets/:id/qa", async (c) => {
  const actor = requireAdmin(c.get("actor"));
  const form = await readForm(c);
  const result = form.result ?? "";
  if (!isQaResult(result)) {
    throw new HttpError(400, "Invalid QA result");
  }
  try {
    await submitQa(c.env.DB, {
      ticketId: c.req.param("id"),
      result,
      actorUserId: actor.id,
      notes: form.notes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "QA failed";
    return c.redirect(`/admin/tickets/${c.req.param("id")}?error=${encodeURIComponent(message)}`);
  }
  return c.redirect(`/admin/tickets/${c.req.param("id")}?notice=QA+recorded`);
});

adminRoutes.get("/history", async (c) => {
  const actor = requireAdmin(c.get("actor"));
  const rows = await listDevHistory(c.env.DB);
  return c.html(
    HistoryPage({
      actor,
      path: "/admin/history",
      csrf: c.get("csrfToken") ?? "",
      rows: rows.results,
    }),
  );
});

adminRoutes.get("/templates", async (c) => {
  const actor = requireAdmin(c.get("actor"));
  const templates = await listTemplates(c.env.DB);
  return c.html(
    TemplatesPage({
      actor,
      path: "/admin/templates",
      csrf: c.get("csrfToken") ?? "",
      templates: templates.results,
    }),
  );
});
