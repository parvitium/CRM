import { Csrf, Layout } from "./layout";
import type { Actor } from "../domain/authz";

export function LoginPage(props: {
  actor: Actor | null;
  path: string;
  allowDevLogin: boolean;
  users: { email: string; display_name: string; role: string }[];
  error?: string;
  notice?: string;
}) {
  return (
    <Layout title="Sign in" actor={props.actor} path={props.path} error={props.error} notice={props.notice}>
      <section class="panel narrow">
        <p class="kicker">Parvitium · Tooele County</p>
        <h1>Sign in</h1>
        <p class="lede">
          Magic-link email is the default. Cloudflare Access is honored only when
          AUTH_MODE=access and the Access JWT verifies. There are no passwords in this app.
        </p>
        <form class="stack" method="post" action="/auth/magic">
          <label>
            Email
            <input type="email" name="email" required autocomplete="username" />
          </label>
          <button class="btn" type="submit">
            Email me a link
          </button>
        </form>
        {props.allowDevLogin ? (
          <form class="stack muted-box" method="post" action="/auth/dev-login">
            <p class="kicker">Local / test only</p>
            <p class="hint">ALLOW_DEV_LOGIN is on. This control is omitted in production.</p>
            <label>
              Dev user
              <select name="email" required>
                {props.users.map((user) => (
                  <option value={user.email}>
                    {user.display_name} · {user.role} · {user.email}
                  </option>
                ))}
              </select>
            </label>
            <button class="btn secondary" type="submit">
              Dev sign-in
            </button>
          </form>
        ) : null}
      </section>
    </Layout>
  );
}

export function MagicConfirmPage(props: { csrf: string; email: string }) {
  return (
    <Layout title="Confirm sign-in" actor={null} path="/auth/magic" referrerPolicy="no-referrer">
      <section class="panel narrow">
        <p class="kicker">Parvitium · Tooele County</p>
        <h1>Confirm sign-in</h1>
        <p class="lede">
          This link will sign you in as <strong>{props.email}</strong>. Confirm only if you
          requested this link. It works once and will not be consumed until you submit this form.
        </p>
        <form class="stack" method="post" action="/auth/magic/consume">
          <Csrf token={props.csrf} />
          <button class="btn" type="submit">
            Sign in
          </button>
        </form>
      </section>
    </Layout>
  );
}
