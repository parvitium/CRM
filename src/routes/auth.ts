import { Hono } from "hono";
import { isAccessConfigured } from "../auth/access";
import { createSession, sessionCookie } from "../auth/session";
import type { AppEnv } from "../app-env";
import { findUserByEmail, listKnownDevLogins } from "../db/queries";
import { HttpError } from "../domain/http";
import { LoginPage } from "../views/login";
import { signOut } from "../middleware/auth";

export const authRoutes = new Hono<AppEnv>();

authRoutes.get("/login", async (c) => {
  const actor = c.get("actor");
  if (actor) {
    return c.redirect("/admin");
  }
  const allowDevLogin = String(c.env.ALLOW_DEV_LOGIN) === "true";
  const users = allowDevLogin ? (await listKnownDevLogins(c.env.DB)).results : [];
  return c.html(
    LoginPage({
      actor,
      path: "/login",
      allowDevLogin,
      users,
      error: c.req.query("error"),
      notice: c.req.query("notice") ?? undefined,
    }),
  );
});

authRoutes.post("/auth/dev-login", async (c) => {
  if (String(c.env.ALLOW_DEV_LOGIN) !== "true" || isAccessConfigured(c.env)) {
    throw new HttpError(403, "Dev login is disabled");
  }
  const form = await c.req.parseBody();
  const email = typeof form.email === "string" ? form.email : "";
  const user = await findUserByEmail(c.env.DB, email);
  if (!user) {
    return c.redirect("/login?error=Unknown+dev+user");
  }
  const created = await createSession(c.env.DB, user.id);
  c.header("Set-Cookie", sessionCookie(created.rawToken, c.req.url));
  return c.redirect("/admin");
});

authRoutes.all("/logout", async (c) => {
  if (c.req.method !== "POST") {
    c.header("Allow", "POST");
    return c.text("Method Not Allowed", 405);
  }
  const cookies = await signOut(c);
  cookies.forEach((cookie, index) => {
    c.header("Set-Cookie", cookie, index === 0 ? undefined : { append: true });
  });
  return c.redirect("/login");
});
