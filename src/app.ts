import { Hono } from "hono";
import { createAdapters } from "./adapters";
import type { AppEnv } from "./app-env";
import { csrfMiddleware, handleError, sessionMiddleware } from "./middleware/auth";
import { securityHeaders } from "./middleware/security";
import { adminRoutes } from "./routes/admin";
import { apiRoutes } from "./routes/api";
import { authRoutes } from "./routes/auth";
import { portalRoutes } from "./routes/portal";

export function createApp() {
  const app = new Hono<AppEnv>();
  app.onError(handleError);
  app.use("*", securityHeaders);
  app.use("*", async (c, next) => {
    c.set("adapters", createAdapters(c.env));
    await next();
  });
  app.use("*", sessionMiddleware);
  app.use("*", csrfMiddleware);

  app.get("/health", (c) => c.json({ ok: true, service: "parvitium-crm" }));

  app.route("/", authRoutes);
  app.route("/admin", adminRoutes);
  app.route("/portal", portalRoutes);
  app.route("/api", apiRoutes);

  app.get("/", (c) => {
    const actor = c.get("actor");
    if (!actor) {
      return c.redirect("/login");
    }
    return c.redirect(actor.role === "admin" ? "/admin" : "/portal");
  });

  app.notFound(async (c) => {
    if (c.env.ASSETS && !c.req.path.startsWith("/api/")) {
      const asset = await c.env.ASSETS.fetch(c.req.raw);
      if (asset.status !== 404) {
        return asset;
      }
    }
    if (c.req.path.startsWith("/api/")) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.text("Not found", 404);
  });

  return app;
}
