import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../app-env";
import { requirePortalCustomer } from "../domain/authz";
import { HttpError } from "../domain/http";
import { readForm, noticeFromQuery } from "../http/form";
import {
  callStats,
  createMessage,
  getCustomer,
  getGbp,
  getSubscriptionForCustomer,
  listCalls,
  listMessages,
  listPayments,
  listReviews,
  listSeo,
  listSocialAccounts,
  listWebsites,
} from "../db/queries";
import {
  PortalCalls,
  PortalGbp,
  PortalHome,
  PortalMessages,
  PortalPackage,
  PortalReviews,
  PortalSeo,
  PortalSite,
  PortalSocial,
} from "../views/portal";

export const portalRoutes = new Hono<AppEnv>();

portalRoutes.use("*", async (c, next) => {
  requirePortalCustomer(c.get("actor"));
  await next();
});

async function scopedCustomer(c: Context<AppEnv>) {
  const actor = requirePortalCustomer(c.get("actor"));
  const customer = await getCustomer(c.env.DB, actor.customerId);
  if (!customer) {
    throw new HttpError(404, "Customer profile missing");
  }
  return { actor, customer };
}

portalRoutes.get("/", async (c) => {
  const { actor, customer } = await scopedCustomer(c);
  const [subscription, websites, gbp, stats, reviews] = await Promise.all([
    getSubscriptionForCustomer(c.env.DB, customer.id),
    listWebsites(c.env.DB, customer.id),
    getGbp(c.env.DB, customer.id),
    callStats(c.env.DB, customer.id),
    listReviews(c.env.DB, customer.id),
  ]);
  const openReviews = reviews.results.filter(
    (row) => row.status === "new" || row.status === "drafted",
  ).length;
  return c.html(
    PortalHome({
      actor,
      path: "/portal",
      customer,
      subscription,
      website: websites.results[0] ?? null,
      gbp,
      callStats: stats,
      openReviews,
    }),
  );
});

portalRoutes.get("/package", async (c) => {
  const { actor, customer } = await scopedCustomer(c);
  const [subscription, payments] = await Promise.all([
    getSubscriptionForCustomer(c.env.DB, customer.id),
    listPayments(c.env.DB, customer.id),
  ]);
  return c.html(
    PortalPackage({
      actor,
      path: "/portal/package",
      subscription,
      payments: payments.results,
    }),
  );
});

portalRoutes.get("/site", async (c) => {
  const { actor, customer } = await scopedCustomer(c);
  const websites = await listWebsites(c.env.DB, customer.id);
  return c.html(PortalSite({ actor, path: "/portal/site", websites: websites.results }));
});

portalRoutes.get("/social", async (c) => {
  const { actor, customer } = await scopedCustomer(c);
  const social = await listSocialAccounts(c.env.DB, customer.id);
  return c.html(PortalSocial({ actor, path: "/portal/social", social: social.results }));
});

portalRoutes.get("/gbp", async (c) => {
  const { actor, customer } = await scopedCustomer(c);
  const gbp = await getGbp(c.env.DB, customer.id);
  return c.html(PortalGbp({ actor, path: "/portal/gbp", gbp }));
});

portalRoutes.get("/seo", async (c) => {
  const { actor, customer } = await scopedCustomer(c);
  const seo = await listSeo(c.env.DB, customer.id);
  return c.html(PortalSeo({ actor, path: "/portal/seo", seo: seo.results }));
});

portalRoutes.get("/calls", async (c) => {
  const { actor, customer } = await scopedCustomer(c);
  const [calls, stats] = await Promise.all([
    listCalls(c.env.DB, customer.id),
    callStats(c.env.DB, customer.id),
  ]);
  return c.html(
    PortalCalls({ actor, path: "/portal/calls", calls: calls.results, stats }),
  );
});

portalRoutes.get("/reviews", async (c) => {
  const { actor, customer } = await scopedCustomer(c);
  const reviews = await listReviews(c.env.DB, customer.id);
  return c.html(PortalReviews({ actor, path: "/portal/reviews", reviews: reviews.results }));
});

portalRoutes.get("/messages", async (c) => {
  const { actor, customer } = await scopedCustomer(c);
  const messages = await listMessages(c.env.DB, customer.id);
  return c.html(
    PortalMessages({
      actor,
      path: "/portal/messages",
      csrf: c.get("csrfToken") ?? "",
      notice: noticeFromQuery(c).notice,
      messages: messages.results,
    }),
  );
});

portalRoutes.post("/messages", async (c) => {
  const { customer } = await scopedCustomer(c);
  const form = await readForm(c);
  await createMessage(c.env.DB, {
    customerId: customer.id,
    fromRole: "customer",
    subject: form.subject ?? "Portal message",
    body: form.body ?? "",
    flag: form.flag === "1",
    flagReason: form.flag === "1" ? "Customer flagged" : undefined,
  });
  return c.redirect("/portal/messages?notice=Sent");
});
