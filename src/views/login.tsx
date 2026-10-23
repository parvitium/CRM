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
        <h1>Admin desk</h1>
        <p class="lede">
          This CRM is Adam-only. Production sits behind Cloudflare Access on{" "}
          <strong>crm.parvitium.com</strong>. The Worker validates{" "}
          <code>Cf-Access-Jwt-Assertion</code> against the team JWKS. There is no
          customer portal and no password store.
        </p>
        {props.allowDevLogin ? (
          <form class="stack muted-box" method="post" action="/auth/dev-login">
            <p class="kicker">Local / test only</p>
            <p class="hint">ALLOW_DEV_LOGIN is on. Production vars leave this empty.</p>
            <label>
              Dev user
              <select name="email" required>
                {props.users.map((user) => (
                  <option value={user.email}>
                    {user.display_name} · {user.email}
                  </option>
                ))}
              </select>
            </label>
            <button class="btn" type="submit">
              Dev sign-in
            </button>
          </form>
        ) : (
          <p class="hint">
            If you reached this page, Access did not run or the JWT did not map to an
            admin user. See docs/cloudflare-access.md.
          </p>
        )}
      </section>
    </Layout>
  );
}
