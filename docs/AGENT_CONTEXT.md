# Agent context — Parvitium CRM

Read this before changing the repo. Adam Lundell owns Parvitium LLC (web design + marketing for small contractors in Tooele County, UT) and TooeleTrades.com.

## Product

**Admin-only dashboard for Adam** (single operator). There is no customer portal and no customer login.

It tracks:

1. **Parvitium customers** — website / visibility clients (One-Page, Starter, Job Pages).
2. **TooeleTrades directory listings** — Free / Pro Listing $29/mo / Featured + Leads $79/mo / Managed Growth $229/mo.

A record can be `parvitium`, `tooele_trades`, or `both` (website client who also has a listing). Proposed production host: **crm.parvitium.com**, behind Cloudflare Access.

Handwritten spec (transcribed) lives in the original issue. Scope is the foundation, not a live cutover.

## Stack invariants

- Cloudflare Workers + D1. R2 later for recordings. No Postgres, no Pages.
- Hono + server-rendered JSX. Do not introduce a SPA without a reason.
- Adapter interfaces in `src/adapters/types.ts`. Production implementations replace mocks; routes should not call Stripe/Google/Retell SDKs directly.
- `wrangler types` owns `Env`. Do not hand-write a competing `interface Env`.
- Compatibility date is current as of this foundation (`2026-10-23`). Bump it when you touch Wrangler config and re-test.
- **Do not deploy. Do not create D1/R2/Access/Workers in the Cloudflare account.** `database_id` is a placeholder on purpose.

## Auth

- Cloudflare Access is production auth. Validate `Cf-Access-Jwt-Assertion` against the team JWKS (`CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD`). Ignore `Cf-Access-Authenticated-User-Email`. See `docs/cloudflare-access.md`.
- Committed `wrangler.jsonc` is `AUTH_MODE=access` with empty team/AUD. That package **fails closed**: every `/admin` and `/api` route returns 403. It never falls through to cookie sessions.
- Cookie sessions and `POST /auth/dev-login` work only when `AUTH_MODE=dev` **and** the request host is loopback (`localhost` / `127.0.0.1` / `::1`) **and** `ALLOW_DEV_LOGIN=true`. `AUTH_MODE=access` returns 404 for `/auth/dev-login` even on localhost. A leftover `pv_session` cookie is ignored whenever Access is required.
- When Access vars are set, a missing/invalid JWT is unauthenticated even if a leftover session cookie is present. A verified JWT whose email is not an admin user is 403.
- `users` is admin-only. Identity email from the JWT must match `users.email`.
- Sessions exist so CSRF tokens have somewhere to live. Store `sha256(token)` only. HTTPS cookie is `__Host-pv_session` (Secure, Path=/, no Domain, HttpOnly, SameSite=Lax). HTTP `wrangler dev` fallback is `pv_session` without Secure.
- No magic links. No customer users. No homegrown customer auth.
- CSRF on authenticated POSTs and logout (POST only). Compare constant-time with no length short-circuit.
- Security headers on every response: CSP (`frame-ancestors`), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS on HTTPS.
- `/health` and `/health/` never mint a session.

## Plans

**Single source of truth:** `src/config/plans.ts`. Seed `packages` rows and admin UI must match that file. Do not scatter prices in views or SQL comments.

Parvitium website packages (from https://parvitium.com/websites/):

| Plan | Setup | Monthly |
| --- | --- | --- |
| One-Page | $797 | $39 |
| Starter | $1,200 | $49 |
| Job Pages | $2,400 | $99 |

Starter/Job Pages also have year-one payment plans documented in the plan `description`. Extra edits past the monthly cap: `$125/hour` (`EXTRA_EDIT_HOURLY_CENTS`).

TooeleTrades listing tiers (Adam):

| Plan | Monthly |
| --- | --- |
| Free listing | $0 |
| Pro Listing | $29 |
| Featured + Leads | $79 |
| Managed Growth | $229 |

Payments: Stripe customer / subscription / Payment Link / PaymentIntent **ids only**. No card data.

## Social credentials (non-negotiable)

Customers’ Facebook / Instagram / X / TikTok / YouTube **passwords and tokens are not stored in D1**.

`social_accounts` stores:

- `access_status`: `none | requested | partner_granted | delegated | expired`
- `owner_email`
- `last_verified_at`
- `secrets_manager_ref` — optional 1Password pointer only, must start with `op://`
- notes

Preferred path: Meta Business Suite (or equivalent) **partner / delegated access**, not shared passwords. If a leftover password must exist, it lives in 1Password and the CRM stores `op://Vault/item` only.

Application helpers: `src/domain/social.ts`. Tests fail if a password-like column appears or if `vault://` / `aws-secrets://` / plaintext is accepted.

## Tickets

Types: `dev`, `task`.  
Stages: `backlog` → `ready` → `in-dev` → `in-qa` → `needs-adam` → `closed`.  
QA is separate: a ticket can leave `in-qa` only through `/qa`. Fail → `in-dev`. Pass → `needs-adam`. Both paths set `qa_by` / `qa_result` / `qa_date`. History rows are append-only. Ticket create / transition / QA + the history row must be a single D1 `batch()`. Board **Go** POSTs `return_to=board` and redirects to `/admin/tickets?notice=Moved#<stage>` (no JS; `script-src 'none'`).

Logic lives in `src/domain/tickets.ts` so HTTP handlers stay thin.

## Fictional seed

`seed/seed.sql` + `src/ids.ts`. Businesses (Summit Ridge Roofing, Copper Peak Plumbing, Lakeview Electric, Desert Sage Landscaping, Wasatch Fence) are invented. Do not add real PII.

## Tests you must not break

- Anonymous requests cannot hit `/admin` or `/api/admin/*`
- `/portal` and `/api/portal/*` are 404
- Empty team/AUD with `AUTH_MODE=access` (or any non-local host) returns 403 on `/admin` and `/api`
- `/auth/dev-login` is 404 in `AUTH_MODE=access` and 403 on non-loopback hosts
- Leftover dev session cookies are rejected in `AUTH_MODE=access`
- Access email header alone never authenticates
- Verified Access JWT maps to admin; unknown email is 403
- Configured Access ignores leftover session cookies without a JWT
- Ticket QA fail returns to `in-dev`
- `social_accounts` has no password/token columns; `secrets_manager_ref` is `op://` only
- CSRF required after login and on logout
- Seeded `packages` rows match `src/config/plans.ts`

## Touch points

| Area | Where |
| --- | --- |
| Plans | `src/config/plans.ts` |
| Schema | `migrations/` |
| Seed | `seed/seed.sql`, `src/ids.ts` |
| Domain | `src/domain/` |
| Queries | `src/db/queries.ts` |
| Auth | `src/auth/`, `src/middleware/auth.ts` |
| HTML | `src/views/` |
| Routes | `src/routes/` |
| Adapters | `src/adapters/` |
| Access setup | `docs/cloudflare-access.md` |
| Styles | `public/styles.css` |

When you add a binding, run `npm run cf-typegen` and update README/roadmap if the mock/real line moved.
