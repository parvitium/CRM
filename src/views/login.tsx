import { Layout } from "./layout";
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
          Magic-link email is the default. Cloudflare Access can sit in front and map the
          authenticated email to a user. There are no passwords in this app.
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
