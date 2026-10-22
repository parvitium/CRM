import type { Actor } from "../domain/authz";
import type { Child } from "hono/jsx";

type NavItem = { href: string; label: string };

function navFor(actor: Actor | null): NavItem[] {
  if (!actor) {
    return [];
  }
  if (actor.role === "admin") {
    return [
      { href: "/admin", label: "Dashboard" },
      { href: "/admin/customers", label: "Customers" },
      { href: "/admin/flags", label: "Flags" },
      { href: "/admin/tickets", label: "Tickets" },
      { href: "/admin/history", label: "Dev history" },
      { href: "/admin/templates", label: "Templates" },
    ];
  }
  return [
    { href: "/portal", label: "Home" },
    { href: "/portal/package", label: "Package" },
    { href: "/portal/site", label: "Website" },
    { href: "/portal/social", label: "Social" },
    { href: "/portal/gbp", label: "Google" },
    { href: "/portal/seo", label: "SEO" },
    { href: "/portal/calls", label: "Calls" },
    { href: "/portal/reviews", label: "Reviews" },
    { href: "/portal/messages", label: "Messages" },
  ];
}

export function Layout(props: {
  title: string;
  actor: Actor | null;
  path: string;
  notice?: string | null;
  error?: string | null;
  children: Child;
}) {
  const items = navFor(props.actor);
  const home = props.actor?.role === "customer" ? "/portal" : "/admin";
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title} · Parvitium CRM</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <header class="top">
          <a class="mark" href={props.actor ? home : "/login"}>
            <span class="mark-kicker">Parvitium</span>
            <span class="mark-name">CRM</span>
          </a>
          {items.length > 0 ? (
            <nav class="nav">
              {items.map((item) => (
                <a
                  href={item.href}
                  class={props.path === item.href || props.path.startsWith(`${item.href}/`) ? "on" : ""}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          ) : null}
          <div class="who">
            {props.actor ? (
              <>
                <span>
                  {props.actor.displayName}
                  <small>{props.actor.role}</small>
                </span>
                <form method="post" action="/logout">
                  <button class="text-btn" type="submit">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <a href="/login">Sign in</a>
            )}
          </div>
        </header>
        <main class="page">
          {props.notice ? <p class="banner ok">{props.notice}</p> : null}
          {props.error ? <p class="banner bad">{props.error}</p> : null}
          {props.children}
        </main>
      </body>
    </html>
  );
}

export function Csrf(props: { token: string }) {
  return <input type="hidden" name="csrf" value={props.token} />;
}

export function Empty(props: { children: Child }) {
  return <p class="empty">{props.children}</p>;
}
