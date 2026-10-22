# Parvitium CRM

Internal CRM for [Parvitium LLC](https://parvitium.com) (local web design + marketing for small contractors in Tooele County, UT) and [TooeleTrades.com](https://tooeeletrades.com). Built from Adam Lundell’s handwritten admin/portal spec.

This is a **working foundation**, not a production cutover. Integrations are mocked. **Do not deploy and do not create Cloudflare resources from this repo until the pre-deploy checklist below is done.** The `database_id` in `wrangler.jsonc` is a placeholder on purpose.

## Architecture

```
Browser (admin or customer)
        │
        ▼
Cloudflare Worker  (Hono)
  ├─ HTML pages (Hono JSX) + /styles.css
  ├─ JSON /api/*
  ├─ Auth: session cookie, magic link, optional Cloudflare Access JWT
  └─ Adapter ports (Stripe, GBP, SEO, Retell, reviews, email)
        │
        ▼
D1 (SQLite)     R2 later (call recordings)
```

| Piece | Choice | Why |
| --- | --- | --- |
| Runtime | Cloudflare Worker | Matches the existing Parvitium stack (sites on Workers, Resend, later Retell tools). |
| Database | D1 | Relational model (customers, tickets, QA history) without standing up Postgres. Local SQLite via Wrangler. |
| Object storage | R2 (not bound yet) | Call recordings as objects; DB stores only an object key. |
| API / HTML | [Hono](https://hono.dev/) + JSX | One Worker, no SPA build, forms work without JavaScript, easy HTTP tests. |
| Frontend | Server-rendered TypeScript JSX + `public/styles.css` | Simple TS UI: kanban is HTML columns + POST forms. A React SPA can wait until the data model settles. |
| Tests | Vitest + `@cloudflare/vitest-plugin` | Runs inside `workerd`, including D1. |
| Email | Adapter (mock writes `outbound_emails`) | Swap for Resend later. |
| Payments | Stripe IDs as references + mock adapter | Payment Links today; a real Stripe adapter later. |

There is **no password column** anywhere. Social access is status + owner email + optional **1Password / vault pointer**. See [docs/AGENT_CONTEXT.md](docs/AGENT_CONTEXT.md).

## Local development

Requires Node 22+. No Cloudflare account is required for local work.

```bash
cp .dev.vars.example .dev.vars
npm install
npx wrangler types          # regenerates worker-configuration.d.ts
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Open [http://127.0.0.1:8787](http://127.0.0.1:8787). With `ALLOW_DEV_LOGIN=true` in `.dev.vars`, the login page lists fictional users:

| Email | Role |
| --- | --- |
| `adam@parvitium.example` | Admin |
| `portal.summit@example.test` | Summit Ridge Roofing |
| `portal.copper@example.test` | Copper Peak Plumbing |
| `portal.lakeview@example.test` | Lakeview Electric |
| `portal.desert@example.test` | Desert Sage Landscaping |

Magic-link emails are **not sent**. The mock adapter inserts a row in `outbound_emails` and logs the URL. In local Wrangler you can also read that table:

```bash
npx wrangler d1 execute parvitium-crm --local --command "SELECT to_email, body FROM outbound_emails ORDER BY created_at DESC LIMIT 5"
```

### Checks

```bash
npm test
npm run typecheck
npm run dry-run    # packages the Worker; does not deploy
```

CI runs the same three commands. There is **no deploy job**.

## Auth

- **Roles:** `admin` (Adam) and `customer` (one portal user per customer).
- **Session:** random token, SHA-256 stored in `sessions`. On HTTPS the cookie is `__Host-pv_session` (`Secure`, `Path=/`, no `Domain`, `HttpOnly`, `SameSite=Lax`). **Dev fallback:** local `wrangler dev` is `http://127.0.0.1`, and `__Host-` cookies cannot be set without `Secure`, so HTTP uses `pv_session` with `Path=/`, `HttpOnly`, `SameSite=Lax`, and no `Secure`. Raw tokens are never stored.
- **Magic link:** 15-minute, single-use, hashed token. GET `?token=` stores the token in an HttpOnly cookie and 303s to `/auth/magic` (no token in the URL, `Referrer-Policy: no-referrer`). The confirm page shows the account email. POST `/auth/magic/consume` spends it (CSRF + atomic `UPDATE … WHERE used_at IS NULL`). Issuance takes a minimum time and returns the same 302 whether or not the email exists, including when rate-limited. Issuance is limited per email and per IP (D1 sliding window, 5 / 15 min per email, 20 / 15 min per IP). Over-limit attempts are not stored. Production keys the IP bucket from `CF-Connecting-IP` only; `X-Forwarded-For` is used only on local HTTP. Expired `rate_limit_events` are swept globally (opportunistic delete on a fraction of writes, plus a 15-minute cron). The raw token is never logged. **Do not log `/auth/magic` query strings in production** — the first email click still carries `?token=` in the URL (history, proxies, Cloudflare request logs).
- **Cloudflare Access:** only when `AUTH_MODE=access` and `Cf-Access-Jwt-Assertion` verifies against the team JWKS (`CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD`). The `Cf-Access-Authenticated-User-Email` header is ignored otherwise. `/health` and `/health/` never mint a session.
- **Dev login:** only when `ALLOW_DEV_LOGIN=true` (`.dev.vars` / CI). Production `wrangler.jsonc` sets this to empty.
- **CSRF:** required on authenticated POSTs and logout (`csrf` form field or `X-CSRF-Token`). Comparison is constant-time with no length short-circuit. Logout is POST only.
- **Security headers:** every response gets CSP (`frame-ancestors 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and HSTS on HTTPS.
- **Portal isolation:** portal queries use `actor.customerId` from the session. A customer id in the URL is never trusted for authorization. Portal social queries never select `secrets_manager_ref`.

## Data model (D1)

`migrations/0001_init.sql` creates:

customers, packages, subscriptions, payments, website_templates, websites, social_accounts, gbp_profiles, seo_snapshots, call_logs, review_items, messages, flags, tickets, ticket_history, users, sessions, magic_links, outbound_emails, rate_limit_events.

Ticket types: `dev` | `task`.  
Stages: `backlog` → `ready` → `in-dev` → `in-qa` → `needs-adam` → `closed`.  
QA is a separate pass (`qa_by`, `qa_result`, `qa_date`, `qa_notes`). **Fail returns to `in-dev`.** Pass goes to `needs-adam`.

Packages in seed (TooeleTrades prices are from Adam; several Parvitium prices are placeholders — see open questions):

- Parvitium: One-Page `$797 + $39/mo`; Starter / Job Pages / Managed Growth **placeholder prices**
- TooeleTrades: Pro Listing `$29/mo`, Featured + Leads `$79/mo`, Managed Growth `$199/mo`

## What is mocked vs real

| Integration | Status | Notes |
| --- | --- | --- |
| D1 schema + queries | Real | Local / test only until a D1 database is created. |
| Admin + portal UI | Real | Seed data is fictional. |
| Auth sessions / magic links | Real logic | Email delivery is mocked. |
| Stripe | Mock | IDs like `cus_mock_summit` stored as references. |
| Google Business Profile | Mock | |
| SEO rank / AI citation | Mock snapshots | |
| Retell / AI receptionist | Mock call logs | `recording_r2_key` reserved for R2. |
| Review manager | Mock items + draft replies | |
| Resend | Mock `outbound_emails` | |
| Cloudflare Access | JWT + JWKS when `AUTH_MODE=access` | Email header alone is ignored. Dashboard not configured. |
| R2 recordings | Not bound | Commented in `wrangler.jsonc`. |

`wrangler.jsonc` uses a **placeholder** `database_id` (`00000000-0000-4000-8000-000000000001`). Do not omit it (Wrangler may auto-provision). Do not run `wrangler d1 create` or `wrangler deploy` until the checklist below is complete.

## Pre-deploy checklist (do not skip)

Nothing in this repo should create Cloudflare resources or ship to production by accident. Local `npm run dry-run` only packages. CI has **no deploy job**.

1. **Create the D1 database** — `wrangler d1 create parvitium-crm` (Adam, when ready). Copy the returned UUID.
2. **Set its id** — replace the placeholder `database_id` in `wrangler.jsonc` with that UUID. Leave the placeholder in git until then.
3. **Run migrations** — `wrangler d1 migrations apply parvitium-crm` against the remote DB (after the real id is set). Then seed only if you intend to.
4. **Access setup** — decide magic-link + Resend vs Cloudflare Access. If Access: set `AUTH_MODE=access`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, and put the Worker behind an Access policy. Keep `ALLOW_DEV_LOGIN` empty in production vars.
5. **Secrets** — `wrangler secret put` for anything that is not a committed var. Never put secrets in `wrangler.jsonc` or git.
6. **Then** deploy — `wrangler deploy` only after 1–5. Do not deploy with the placeholder D1 id.

## Phased roadmap

1. **Foundation (this PR)** — schema, admin, portal, auth design, mocks, tests, CI.
2. **Adam’s production cutover** — create D1, set secrets via `wrangler secret`, put Access or Resend in front, replace placeholder package prices.
3. **Stripe adapter** — Payment Links first, then subscriptions / webhooks. Still store IDs only.
4. **November call agent** — Retell-compatible Worker tools; persist calls; put recordings in R2.
5. **GBP + reviews** — Google APIs; review manager posts replies after Adam approves.
6. **SEO / AI citation** — scheduled snapshots (GSC / third-party / citation crawler).
7. **Richer UI** — only if the JSX console gets in the way (filters, more board drag-and-drop).

## Security notes

- Never commit `.dev.vars`, Stripe keys, Access JWKS, or 1Password tokens.
- Never add `password`, `token`, or OAuth columns to `social_accounts`.
- Never log `/auth/magic` query strings in production (the first email click still has `?token=`).
- Seed data is fictional (`*.example` / `*.test` emails, `435-555-01xx` phones).
- `npm run dry-run` is the only packaging command in CI. There is no deploy script.
