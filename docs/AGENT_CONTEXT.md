# Agent context — Parvitium CRM

Read this before changing the repo. Adam Lundell owns Parvitium LLC (web design + marketing for small contractors in Tooele County, UT) and TooeleTrades.com.

## Product

Two surfaces, one Worker:

1. **Admin (Adam)** — customer list/detail, flags inbox, ticket board, QA fields, closed-dev history, website templates.
2. **Customer portal** — read-mostly: package, site, GBP, SEO/AI citation, call stats, reviews, messages to Adam.

Handwritten spec (transcribed) lives in the original issue. Scope is the foundation, not a live cutover.

## Stack invariants

- Cloudflare Workers + D1. R2 later for recordings. No Postgres, no Pages.
- Hono + server-rendered JSX. Do not introduce a SPA without a reason.
- Adapter interfaces in `src/adapters/types.ts`. Production implementations replace mocks; routes should not call Stripe/Google/Retell SDKs directly.
- `wrangler types` owns `Env`. Do not hand-write a competing `interface Env`.
- Compatibility date is current as of this foundation (`2026-10-22`). Bump it when you touch Wrangler config and re-test.
- **Do not deploy. Do not create D1/R2/Access/Workers in the Cloudflare account.** `database_id` is a placeholder on purpose.

## Auth

- Roles: `admin` | `customer`. Customer users must have `customer_id`. Admins must not.
- Portal data loads with `requirePortalCustomer(actor)` and `actor.customerId`. Never authorize with a customer id from the URL.
- Sessions: store `sha256(token)` only. HTTPS cookie is `__Host-pv_session` (Secure, Path=/, no Domain, HttpOnly, SameSite=Lax). HTTP `wrangler dev` fallback is `pv_session` without Secure (`__Host-` cannot be set on http://).
- Magic links: hashed, 15 minutes, single use. GET `?token=` 303s to a token-free confirm URL (`no-referrer`); POST consume with CSRF. Confirm page names the account email. Same 302 and a minimum issuance time for unknown emails, including when rate-limited. D1 sliding window: 5 / 15 min per email, 20 / 15 min per IP. Insert only when under the limit (atomic `INSERT … SELECT`). Production IP is `CF-Connecting-IP` only; XFF fallback is HTTP/dev. Expired rows are swept globally (opportunistic + 15-minute cron). Never log the raw token. **Never log `/auth/magic` query strings in production** (Cloudflare request logs, access logs, reverse proxies) — the first email click still carries `?token=`.
- Cloudflare Access: honor only when `AUTH_MODE=access` and `Cf-Access-Jwt-Assertion` verifies against the team JWKS (`CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD`). Ignore `Cf-Access-Authenticated-User-Email` otherwise. `/health` and `/health/` never mint a session.
- `ALLOW_DEV_LOGIN=true` is local/test only. Production vars leave it empty.
- CSRF on authenticated POSTs, logout (POST only), and magic-link consume. Compare constant-time with no length short-circuit.
- Security headers on every response: CSP (including `frame-ancestors`), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS on HTTPS.
- Portal social queries must not `SELECT secrets_manager_ref`.

## Social credentials (non-negotiable)

Customers’ Facebook / Instagram / X / TikTok / YouTube **passwords and tokens are not stored in D1**.

`social_accounts` stores:

- `access_status`: `none | requested | partner_granted | delegated | expired`
- `owner_email`
- `last_verified_at`
- `secrets_manager_ref` — pointer only, must start with `op://`, `vault://`, or `aws-secrets://`
- notes

Preferred path: Meta Business Suite (or equivalent) **partner / delegated access**, not shared passwords. If a leftover password must exist, it lives in 1Password and the CRM stores `op://Vault/item` only.

Application helpers: `src/domain/social.ts`. Tests fail if a password-like column appears.

## Tickets

Types: `dev`, `task`.  
Stages: `backlog` → `ready` → `in-dev` → `in-qa` → `needs-adam` → `closed`.  
QA is separate: a ticket can leave `in-qa` only through `/qa`. Fail → `in-dev`. Pass → `needs-adam`. Both paths set `qa_by` / `qa_result` / `qa_date`. History rows are append-only. Ticket create / transition / QA + the history row must be a single D1 `batch()`. Board **Go** POSTs `return_to=board` and redirects to `/admin/tickets?notice=Moved#<stage>` (no JS; `script-src 'none'`).

Logic lives in `src/domain/tickets.ts` so HTTP handlers stay thin.

## Packages

Seeded in `seed/seed.sql`. Confirm with Adam before treating Parvitium Starter / Job Pages / Managed Growth prices as real. TooeleTrades `$29 / $79 / $199` are from him.

Payments: Stripe customer / subscription / Payment Link / PaymentIntent **ids only**. No card data.

## Fictional seed

`seed/seed.sql` + `src/ids.ts`. Businesses (Summit Ridge Roofing, Copper Peak Plumbing, Lakeview Electric, Desert Sage Landscaping) are invented. Do not add real PII.

## Tests you must not break

- Portal user cannot read another customer (`test/http/isolation.spec.ts`)
- Customer cannot hit `/admin` or `/api/admin/*`
- Ticket QA fail returns to `in-dev`
- `social_accounts` has no password/token columns
- Magic link does not reveal account existence
- CSRF required after login and on logout
- Portal social query never fetches `secrets_manager_ref`

## Touch points

| Area | Where |
| --- | --- |
| Schema | `migrations/` |
| Seed | `seed/seed.sql`, `src/ids.ts` |
| Domain | `src/domain/` |
| Queries | `src/db/queries.ts` |
| Auth | `src/auth/`, `src/middleware/auth.ts` |
| HTML | `src/views/` |
| Routes | `src/routes/` |
| Adapters | `src/adapters/` |
| Styles | `public/styles.css` |

When you add a binding, run `npm run cf-typegen` and update README/roadmap if the mock/real line moved.
