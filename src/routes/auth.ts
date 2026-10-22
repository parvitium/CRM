import { Hono } from "hono";
import { consumeMagicLink, issueMagicLink } from "../auth/magic-link";
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
    return c.redirect(actor.role === "admin" ? "/admin" : "/portal");
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

authRoutes.post("/auth/magic", async (c) => {
  const form = await c.req.parseBody();
  const email = typeof form.email === "string" ? form.email : "";
  if (!email.includes("@")) {
    return c.redirect("/login?error=Enter+a+valid+email");
  }
  const origin = new URL(c.req.url).origin;
  await issueMagicLink(c.env.DB, c.get("adapters").email, email, origin);
  return c.redirect("/login?notice=If+that+email+has+an+account,+a+link+is+on+the+way");
});

authRoutes.get("/auth/magic", async (c) => {
  const token = c.req.query("token") ?? "";
  const userId = await consumeMagicLink(c.env.DB, token);
  if (!userId) {
    return c.redirect("/login?error=That+link+is+invalid+or+expired");
  }
  const created = await createSession(c.env.DB, userId);
  c.header("Set-Cookie", sessionCookie(created.rawToken, c.req.url));
  const user = await c.env.DB.prepare("SELECT role FROM users WHERE id = ?")
    .bind(userId)
    .first<{ role: string }>();
  return c.redirect(user?.role === "admin" ? "/admin" : "/portal");
});

authRoutes.post("/auth/dev-login", async (c) => {
  if (String(c.env.ALLOW_DEV_LOGIN) !== "true") {
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
  return c.redirect(user.role === "admin" ? "/admin" : "/portal");
});

authRoutes.post("/logout", async (c) => {
  c.header("Set-Cookie", await signOut(c));
  return c.redirect("/login");
});
