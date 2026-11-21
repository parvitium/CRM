# Parvitium CRM

Internal **admin-only** CRM for [Parvitium LLC](https://parvitium.com) (local web design + marketing for small contractors in Tooele County, UT) and [TooeleTrades.com](https://tooeletrades.com). Built for Adam Lundell as a single-operator desk.

This is a **working foundation**, not a production cutover. Integrations are mocked. **Do not deploy and do not create Cloudflare resources from this repo until the pre-deploy checklist below is done.** The `database_id` in `wrangler.jsonc` is a placeholder on purpose.

Proposed production host: **crm.parvitium.com**, behind Cloudflare Access. There is no customer portal.

## Architecture

```
Browser (Adam)
        │
        ▼
Cloudflare Access  (crm.parvitium.com)
        │  Cf-Access-Jwt-Assertion
        ▼
Cloudflare Worker  (Hono)
  ├─ HTML pages (Hono JSX) + /styles.css
  ├─ JSON /api/admin/*
  ├─ Auth: Access JWT → admin user; local AUTH_MODE=dev + loopback only
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
| Auth | Cloudflare Access JWT | No homegrown customer auth. Dev login is local-only. |
| Email | Adapter (mock writes `outbound_emails`) | Swap for Resend later (transactional, not login). |
| Payments | Stripe IDs as references + mock adapter | Payment Links today; a real Stripe adapter later. |

There is **no password column** anywhere. Social access is status + owner email + optional **1Password `op://` pointer**. See [docs/AGENT_CONTEXT.md](docs/AGENT_CONTEXT.md).

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

Open [http://127.0.0.1:8787](http://127.0.0.1:8787). `.dev.vars` must set `AUTH_MODE=dev` and `ALLOW_DEV_LOGIN=true`. Sign in as `adam@parvitium.example`. Host must be loopback — cookie login is refused on any other hostname, and `AUTH_MODE=access` (the committed default) fail-closes `/admin` and `/api` until Access vars are set.

### Checks

```bash
npm test
npm run typecheck
npm run dry-run    # packages the Worker; does not deploy
```

CI runs the same three commands. There is **no deploy job**.

## Auth

- **Operator:** Adam only (`users.role = 'admin'`). No customer users.
- **Production:** Cloudflare Access in front of `crm.parvitium.com`. The Worker validates `Cf-Access-Jwt-Assertion` against the team JWKS (`CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD`). The spoofable `Cf-Access-Authenticated-User-Email` header is ignored. Setup steps: [docs/cloudflare-access.md](docs/cloudflare-access.md).
- **Session:** random token, SHA-256 stored in `sessions` (CSRF). On HTTPS the cookie is `__Host-pv_session` (`Secure`, `Path=/`, no `Domain`, `HttpOnly`, `SameSite=Lax`). **Dev fallback:** local `wrangler dev` is `http://127.0.0.1`, so HTTP uses `pv_session` without `Secure`.
- **Dev login:** only when `AUTH_MODE=dev`, the request host is loopback, and `ALLOW_DEV_LOGIN=true` (`.dev.vars` / tests). Committed `wrangler.jsonc` is `AUTH_MODE=access` with empty team/AUD — that **fails closed** (403 on `/admin` and `/api`). `AUTH_MODE=access` returns 404 for `/auth/dev-login`. A leftover session cookie is never enough; a valid JWT is required whenever Access is in force.
- **CSRF:** required on authenticated POSTs and logout (`csrf` form field or `X-CSRF-Token`). Comparison is constant-time with no length short-circuit. Logout is POST only.
- **Security headers:** every response gets CSP (`frame-ancestors 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and HSTS on HTTPS.

## Plans

Prices live in **one file**: [`src/config/plans.ts`](src/config/plans.ts). Seed and UI must match it.

**Parvitium** (website / visibility, from [parvitium.com/websites](https://parvitium.com/websites/)):

- One-Page — $797 setup + $39/mo
- Starter — $1,200 setup + $49/mo
- Job Pages — $2,400 setup + $99/mo

**TooeleTrades** (directory listings):

- Free listing
- Pro Listing — $29/mo
- Featured + Leads — $79/mo
- Managed Growth — $229/mo

A customer `kind` is `parvitium`, `tooele_trades`, or `both`. One customer may hold a website package and a listing.

## Data model (D1)

`migrations/0001_init.sql` creates:

customers, packages, subscriptions, payments, website_templates, websites, social_accounts, gbp_profiles, seo_snapshots, call_logs, review_items, messages, flags, tickets, ticket_history, users, sessions, outbound_emails.

Ticket types: `dev` | `task`.  
Stages: `backlog` → `ready` → `in-dev` → `in-qa` → `needs-adam` → `closed`.  
QA is a separate pass (`qa_by`, `qa_result`, `qa_date`, `qa_notes`). **Fail returns to `in-dev`.** Pass goes to `needs-adam`.

## What is mocked vs real

| Integration | Status | Notes |
| --- | --- | --- |
| D1 schema + queries | Real | Local / test only until a D1 database is created. |
| Admin UI | Real | Seed data is fictional. No portal. |
| Cloudflare Access | JWT + JWKS when team domain + AUD are set | Email header alone is ignored. Dashboard not configured. |
| Stripe | Mock | IDs like `cus_mock_summit` stored as references. |
| Google Business Profile | Mock | |
| SEO rank / AI citation | Mock snapshots | |
| Retell / AI receptionist | Mock call logs | `recording_r2_key` reserved for R2. |
| Review manager | Mock items + draft replies | |
| Resend | Mock `outbound_emails` | Not used for login. |
| R2 recordings | Not bound | Commented in `wrangler.jsonc`. |

`wrangler.jsonc` uses a **placeholder** `database_id` (`00000000-0000-4000-8000-000000000001`). Do not omit it (Wrangler may auto-provision). Do not run `wrangler d1 create` or `wrangler deploy` until the checklist below is complete.

## Pre-deploy checklist (do not skip)

Nothing in this repo should create Cloudflare resources or ship to production by accident. Local `npm run dry-run` only packages. CI has **no deploy job**.

1. **Create the D1 database** — `wrangler d1 create parvitium-crm` (Adam, when ready). Copy the returned UUID.
2. **Set its id** — replace the placeholder `database_id` in `wrangler.jsonc` with that UUID. Leave the placeholder in git until then.
3. **Run migrations** — `wrangler d1 migrations apply parvitium-crm` against the remote DB (after the real id is set). Then seed only if you intend to.
4. **Access setup** — follow [docs/cloudflare-access.md](docs/cloudflare-access.md). Set `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`. Put `crm.parvitium.com` behind an Allow policy for Adam’s email. Keep `AUTH_MODE=access` and `ALLOW_DEV_LOGIN` empty. Insert the real Access email as the admin user (seed email is fictional). Deploying without team/AUD leaves the desk 403 (fail closed), which is intentional.
5. **Secrets** — `wrangler secret put` for anything that is not a committed var. Never put secrets in `wrangler.jsonc` or git.
6. **Then** deploy — `wrangler deploy` only after 1–5. Do not deploy with the placeholder D1 id.

## Phased roadmap

1. **Foundation (this PR)** — schema, admin desk, Access JWT, plan catalog, mocks, tests, CI.
2. **Adam’s production cutover** — create D1, set Access vars, bind `crm.parvitium.com`.
3. **Stripe adapter** — Payment Links first, then subscriptions / webhooks. Still store IDs only.
4. **November call agent** — Retell-compatible Worker tools; persist calls; put recordings in R2.
5. **GBP + reviews** — Google APIs; review manager posts replies after Adam approves.
6. **SEO / AI citation** — scheduled snapshots (GSC / third-party / citation crawler).
7. **Richer UI** — only if the JSX console gets in the way (filters, more board drag-and-drop).

## Security notes

- Never commit `.dev.vars`, Stripe keys, Access JWKS, or 1Password tokens.
- Never add `password`, `token`, or OAuth columns to `social_accounts`. Pointers are `op://` only.
- Seed data is fictional (`*.example` / `*.test` emails, `435-555-01xx` phones).
- `npm run dry-run` is the only packaging command in CI. There is no deploy script.
