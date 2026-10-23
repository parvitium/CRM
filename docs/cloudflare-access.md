# Cloudflare Access setup — Adam

Production hostname: **crm.parvitium.com** (proposed). The CRM is Adam-only. Access is the login. The Worker still validates the JWT so a raw `workers.dev` hit cannot spoof `Cf-Access-Authenticated-User-Email`.

Do not create the Access application, DNS record, or D1 database from this repo until you are ready to deploy.

## Fail closed (read this first)

Committed `wrangler.jsonc` is the **safe production default**:

| Variable | Committed value | Meaning |
| --- | --- | --- |
| `AUTH_MODE` | `access` | JWT required. Cookie /dev-login is off, including on localhost. |
| `CF_ACCESS_TEAM_DOMAIN` | empty | Must be set at deploy. |
| `CF_ACCESS_AUD` | empty | Must be set at deploy. Empty AUD is never treated as “skip Access”. |
| `ALLOW_DEV_LOGIN` | empty | Ignored unless `AUTH_MODE=dev` **and** the request host is loopback. |

If `AUTH_MODE=access` (or the request is not local-dev) and team domain or AUD is missing, **every `/admin` and `/api` route returns 403**. The Worker does not fall through to cookie sessions, leftover `__Host-pv_session` / `pv_session` cookies, or `ALLOW_DEV_LOGIN`.

Local-dev cookie auth is allowed only when **all** of these are true:

1. `AUTH_MODE=dev` (`.dev.vars` only — never the committed config)
2. Request hostname is `localhost`, `127.0.0.1`, or `::1`
3. `ALLOW_DEV_LOGIN=true`

`AUTH_MODE=access` refuses `POST /auth/dev-login` with **404** even on loopback. `AUTH_MODE=dev` on a non-loopback host (`crm.test`, `workers.dev`, the production hostname) refuses it with **403**, and admin/API still fail closed if Access vars are empty.

## 1. Custom domain

1. In **Workers & Pages** → this Worker → **Settings** → **Domains & Routes**.
2. Add custom domain `crm.parvitium.com` on the `parvitium.com` zone.
3. Prefer turning off public `workers.dev` (or put Access on that hostname too) so the Worker is only reachable through the Access app.

## 2. Self-hosted Access application

1. Cloudflare dashboard → **Zero Trust** → **Access controls** → **Applications**.
2. **Create new application** → **Self-hosted**.
3. Name it `Parvitium CRM`.
4. Public hostname: `crm.parvitium.com` (path `/` covers the whole app).
5. Session duration: pick something short enough that a stolen browser session dies (for example 24 hours).
6. Create a reusable **Allow** policy:
   - Include → **Emails** → your Access identity email (the Google / Cloudflare account you actually sign in with).
   - Do not allow `@parvitium.com` as a whole domain unless you want every future mailbox in.
7. Save. Copy the application **AUD** tag (Application Audience). Docs: [Validate JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

`/health` and `/health/` stay public in the Worker (no session). If you want probes to skip the Access login, add a bypass policy for those paths, or leave them behind Access too — either is fine for a single-operator desk.

## 3. Worker environment

Set these on the Worker (vars, not git):

| Variable | Value |
| --- | --- |
| `AUTH_MODE` | `access` (already the committed default) |
| `CF_ACCESS_TEAM_DOMAIN` | `https://<your-team>.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | the AUD tag from step 2 |
| `ALLOW_DEV_LOGIN` | empty |

Team domain can also be stored as `<team>.cloudflareaccess.com` without the scheme; the Worker normalizes it.

The Worker:

1. Reads `Cf-Access-Jwt-Assertion`.
2. Fetches JWKS from `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`.
3. Verifies RS256, issuer, audience, expiry.
4. Maps `email` from the JWT to `users.email` where `role = 'admin'`.
5. Ignores `Cf-Access-Authenticated-User-Email`.

If the JWT is valid but the email is not in `users`, the response is **403**. Seed uses `adam@parvitium.example` for local tests only. Before go-live, insert (or update) your real Access email as the admin user.

## 4. Local development

Access does not run in `wrangler dev` unless you paste a real team domain and AUD. Copy `.dev.vars.example` to `.dev.vars`:

```
AUTH_MODE=dev
ALLOW_DEV_LOGIN=true
```

Open [http://127.0.0.1:8787](http://127.0.0.1:8787). Host must be loopback. Do not point a custom hostname at the local Worker and expect cookie login.

Never set `AUTH_MODE=access` in `.dev.vars` without both Access vars. Never enable `ALLOW_DEV_LOGIN` on the deployed Worker.

## 5. Sign-out

The in-app **Sign out** button clears the CRM session cookie. Access itself uses `CF_Authorization`. To end the Access session:

`https://<your-team>.cloudflareaccess.com/cdn-cgi/access/logout`

## References

- [Validate JWTs from Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Self-hosted public apps](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)
- [Protect a Worker hostname](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
