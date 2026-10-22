import type { Actor } from "../domain/authz";
import { allowedTransitions, TICKET_STAGES, type TicketStage } from "../domain/tickets";
import { socialAccessLabel, type AccessStatus } from "../domain/social";
import { Csrf, Empty, Layout } from "./layout";
import { money, productLineLabel, when, whenTime } from "./format";

export function AdminHome(props: {
  actor: Actor;
  path: string;
  csrf: string;
  notice?: string;
  counts: { customers: number; openFlags: number; openTickets: number; pastDue: number };
  flags: Record<string, unknown>[];
}) {
  return (
    <Layout title="Dashboard" actor={props.actor} path={props.path} csrf={props.csrf} notice={props.notice}>
      <p class="kicker">Adam’s desk</p>
      <h1>Dashboard</h1>
      <div class="stats">
        <a class="stat" href="/admin/customers">
          <strong>{props.counts.customers}</strong>
          <span>Customers</span>
        </a>
        <a class="stat" href="/admin/flags">
          <strong>{props.counts.openFlags}</strong>
          <span>Open flags</span>
        </a>
        <a class="stat" href="/admin/tickets">
          <strong>{props.counts.openTickets}</strong>
          <span>Open tickets</span>
        </a>
        <a class="stat warn" href="/admin/flags">
          <strong>{props.counts.pastDue}</strong>
          <span>Past due</span>
        </a>
      </div>
      <h2>Needs a look</h2>
      {props.flags.length === 0 ? (
        <Empty>No open flags.</Empty>
      ) : (
        <ul class="flag-list">
          {props.flags.slice(0, 6).map((flag) => (
            <li>
              <span class={`sev ${String(flag.severity)}`}>{String(flag.severity)}</span>
              <a href="/admin/flags">{String(flag.title)}</a>
              <small>{String(flag.business_name)}</small>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}

export function CustomerListPage(props: {
  actor: Actor;
  path: string;
  csrf: string;
  notice?: string;
  customers: Record<string, unknown>[];
  packages: { id: string; name: string; product_line: string }[];
}) {
  return (
    <Layout title="Customers" actor={props.actor} path={props.path} csrf={props.csrf} notice={props.notice}>
      <p class="kicker">Accounts</p>
      <h1>Customers</h1>
      <div class="split">
        <table class="table">
          <thead>
            <tr>
              <th>Business</th>
              <th>Package</th>
              <th>Status</th>
              <th>Flags</th>
              <th>City</th>
            </tr>
          </thead>
          <tbody>
            {props.customers.map((row) => (
              <tr>
                <td>
                  <a href={`/admin/customers/${row.id}`}>{String(row.business_name)}</a>
                </td>
                <td>
                  {productLineLabel(String(row.product_line ?? ""))}
                  {row.package_name ? ` · ${String(row.package_name)}` : ""}
                </td>
                <td>
                  <span class={`pill ${String(row.subscription_status ?? "none")}`}>
                    {String(row.subscription_status ?? "none")}
                  </span>
                </td>
                <td>{String(row.open_flags)}</td>
                <td>{String(row.city ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <form class="panel stack" method="post" action="/admin/customers">
          <h2>Add customer</h2>
          <Csrf token={props.csrf} />
          <label>
            Business
            <input name="business_name" required />
          </label>
          <label>
            Contact name
            <input name="contact_name" required />
          </label>
          <label>
            Contact email
            <input type="email" name="contact_email" required />
          </label>
          <label>
            Phone
            <input name="phone" />
          </label>
          <label>
            City
            <input name="city" />
          </label>
          <label>
            Package
            <select name="package_id">
              <option value="">None yet</option>
              {props.packages.map((pkg) => (
                <option value={pkg.id}>
                  {productLineLabel(pkg.product_line)} · {pkg.name}
                </option>
              ))}
            </select>
          </label>
          <button class="btn" type="submit">
            Save
          </button>
        </form>
      </div>
    </Layout>
  );
}

export function CustomerDetailPage(props: {
  actor: Actor;
  path: string;
  csrf: string;
  customer: Record<string, unknown>;
  subscription: Record<string, unknown> | null;
  payments: Record<string, unknown>[];
  websites: Record<string, unknown>[];
  social: Record<string, unknown>[];
  gbp: Record<string, unknown> | null;
  seo: Record<string, unknown>[];
  calls: Record<string, unknown>[];
  callStats: { count: number; total_seconds: number; avg_seconds: number } | null;
  reviews: Record<string, unknown>[];
  messages: Record<string, unknown>[];
  tickets: Record<string, unknown>[];
}) {
  const c = props.customer;
  return (
    <Layout title={String(c.business_name)} actor={props.actor} path={props.path} csrf={props.csrf}>
      <p class="kicker">
        <a href="/admin/customers">Customers</a>
      </p>
      <h1>{String(c.business_name)}</h1>
      <p class="lede">
        {String(c.contact_name)} · {String(c.contact_email)}
        {c.phone ? ` · ${String(c.phone)}` : ""}
        {c.city ? ` · ${String(c.city)}, ${String(c.county)}` : ""}
      </p>

      <div class="grid-2">
        <section class="panel">
          <h2>Package</h2>
          {props.subscription ? (
            <dl class="meta">
              <div>
                <dt>Line / tier</dt>
                <dd>
                  {productLineLabel(String(props.subscription.product_line))} ·{" "}
                  {String(props.subscription.package_name)}
                </dd>
              </div>
              <div>
                <dt>Price</dt>
                <dd>
                  {money(Number(props.subscription.setup_price_cents))} setup ·{" "}
                  {money(Number(props.subscription.monthly_price_cents))}/mo
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span class={`pill ${String(props.subscription.status)}`}>
                    {String(props.subscription.status)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Stripe refs</dt>
                <dd class="mono">
                  {String(props.subscription.stripe_customer_id ?? "—")}
                  <br />
                  {String(props.subscription.stripe_subscription_id ?? "no sub")}
                  <br />
                  {String(props.subscription.stripe_payment_link_id ?? "no payment link")}
                </dd>
              </div>
            </dl>
          ) : (
            <Empty>No subscription on file.</Empty>
          )}
          {props.payments.length > 0 ? (
            <table class="table compact">
              <thead>
                <tr>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {props.payments.map((p) => (
                  <tr>
                    <td class="mono">{String(p.stripe_payment_intent_id ?? p.id)}</td>
                    <td>{money(Number(p.amount_cents))}</td>
                    <td>{String(p.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>

        <section class="panel">
          <h2>Website</h2>
          {props.websites.length === 0 ? (
            <Empty>No site recorded.</Empty>
          ) : (
            props.websites.map((site) => (
              <dl class="meta">
                <div>
                  <dt>Name</dt>
                  <dd>{String(site.name)}</dd>
                </div>
                <div>
                  <dt>URL</dt>
                  <dd>
                    {site.url ? (
                      <a href={String(site.url)} rel="noreferrer">
                        {String(site.url)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Template</dt>
                  <dd>{String(site.template_name ?? "—")}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{String(site.status)}</dd>
                </div>
              </dl>
            ))
          )}
          {c.external_crm_name ? (
            <p>
              Their CRM: {String(c.external_crm_name)}
              {c.external_crm_url ? (
                <>
                  {" "}
                  · <a href={String(c.external_crm_url)}>{String(c.external_crm_url)}</a>
                </>
              ) : null}
            </p>
          ) : (
            <p class="hint">No external CRM linked. This app is not a replacement for Jobber/HCP.</p>
          )}
        </section>

        <section class="panel">
          <h2>Social access</h2>
          <p class="hint">
            Status and vault pointers only. Passwords are not stored here.
          </p>
          {props.social.length === 0 ? (
            <Empty>No social accounts tracked.</Empty>
          ) : (
            <table class="table compact">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Access</th>
                  <th>Owner email</th>
                  <th>Vault ref</th>
                </tr>
              </thead>
              <tbody>
                {props.social.map((s) => (
                  <tr>
                    <td>{String(s.platform)}</td>
                    <td>{socialAccessLabel(String(s.access_status) as AccessStatus)}</td>
                    <td>{String(s.owner_email ?? "—")}</td>
                    <td class="mono">{String(s.secrets_manager_ref ?? "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section class="panel">
          <h2>Google Business Profile</h2>
          {props.gbp ? (
            <dl class="meta">
              <div>
                <dt>Name</dt>
                <dd>{String(props.gbp.name ?? "—")}</dd>
              </div>
              <div>
                <dt>Place ID</dt>
                <dd class="mono">{String(props.gbp.place_id ?? "not connected")}</dd>
              </div>
              <div>
                <dt>Rating</dt>
                <dd>
                  {props.gbp.rating == null
                    ? "—"
                    : `${String(props.gbp.rating)} (${String(props.gbp.review_count ?? 0)} reviews)`}
                </dd>
              </div>
              <div>
                <dt>Synced</dt>
                <dd>{when(props.gbp.last_synced_at as string | null)}</dd>
              </div>
            </dl>
          ) : (
            <Empty>No GBP row.</Empty>
          )}
        </section>
      </div>

      <section class="panel">
        <h2>SEO / AI citation</h2>
        {props.seo.length === 0 ? (
          <Empty>No snapshots yet.</Empty>
        ) : (
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Keyword</th>
                <th>Rank</th>
                <th>AI citation</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {props.seo.map((row) => (
                <tr>
                  <td>{when(String(row.captured_at))}</td>
                  <td>{String(row.keyword)}</td>
                  <td>{row.rank == null ? "—" : String(row.rank)}</td>
                  <td>{row.ai_citation_score == null ? "—" : String(row.ai_citation_score)}</td>
                  <td>{String(row.ai_citation_notes ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section class="panel">
        <h2>AI receptionist</h2>
        <p class="hint">
          {props.callStats
            ? `${props.callStats.count} calls · ${Math.round(props.callStats.total_seconds / 60)} min total · avg ${Math.round(props.callStats.avg_seconds)}s`
            : "No calls"}
          . Recordings will live in R2; only an object key is stored.
        </p>
        {props.calls.length === 0 ? (
          <Empty>No call logs.</Empty>
        ) : (
          <table class="table">
            <thead>
              <tr>
                <th>When</th>
                <th>From</th>
                <th>Duration</th>
                <th>Disposition</th>
                <th>Preview</th>
              </tr>
            </thead>
            <tbody>
              {props.calls.map((call) => (
                <tr>
                  <td>{whenTime(String(call.started_at))}</td>
                  <td class="mono">{String(call.from_number ?? "—")}</td>
                  <td>{String(call.duration_seconds)}s</td>
                  <td>{String(call.disposition ?? "—")}</td>
                  <td>{String(call.transcript_preview ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section class="panel">
        <h2>AI review manager</h2>
        {props.reviews.length === 0 ? (
          <Empty>No reviews.</Empty>
        ) : (
          <ul class="review-list">
            {props.reviews.map((rev) => (
              <li>
                <strong>
                  {String(rev.rating)}★ · {String(rev.author_name)}
                </strong>
                <span class="pill">{String(rev.status)}</span>
                <p>{String(rev.body)}</p>
                {rev.draft_reply ? <blockquote>{String(rev.draft_reply)}</blockquote> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section class="panel">
        <h2>Messages</h2>
        <form class="stack" method="post" action={`/admin/customers/${c.id}/messages`}>
          <Csrf token={props.csrf} />
          <label>
            Subject
            <input name="subject" required />
          </label>
          <label>
            Message
            <textarea name="body" required rows={3} />
          </label>
          <button class="btn" type="submit">
            Send to portal
          </button>
        </form>
        {props.messages.length === 0 ? (
          <Empty>No messages.</Empty>
        ) : (
          <ul class="msg-list">
            {props.messages.map((m) => (
              <li>
                <strong>
                  {String(m.from_role)} · {String(m.subject)}
                </strong>
                <small>{whenTime(String(m.created_at))}</small>
                <p>{String(m.body)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section class="panel">
        <h2>Tickets</h2>
        {props.tickets.length === 0 ? (
          <Empty>No tickets for this customer.</Empty>
        ) : (
          <ul>
            {props.tickets.map((t) => (
              <li>
                <a href={`/admin/tickets/${t.id}`}>{String(t.title)}</a>{" "}
                <span class="pill">{String(t.stage)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Layout>
  );
}

export function FlagsPage(props: {
  actor: Actor;
  path: string;
  csrf: string;
  flags: Record<string, unknown>[];
}) {
  return (
    <Layout title="Flags" actor={props.actor} path={props.path} csrf={props.csrf}>
      <p class="kicker">Inbox</p>
      <h1>Messages & flags</h1>
      {props.flags.length === 0 ? (
        <Empty>Inbox is clear.</Empty>
      ) : (
        <ul class="flag-cards">
          {props.flags.map((flag) => (
            <li class="panel">
              <div class="row">
                <span class={`sev ${String(flag.severity)}`}>{String(flag.severity)}</span>
                <span class="pill">{String(flag.kind)}</span>
              </div>
              <h2>{String(flag.title)}</h2>
              <p>
                <a href={`/admin/customers/${flag.customer_id}`}>{String(flag.business_name)}</a>
              </p>
              <p>{String(flag.detail ?? "")}</p>
              <form method="post" action={`/admin/flags/${flag.id}/resolve`}>
                <Csrf token={props.csrf} />
                <button class="btn secondary" type="submit">
                  Resolve
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}

export function TicketBoardPage(props: {
  actor: Actor;
  path: string;
  csrf: string;
  notice?: string;
  tickets: { id: string; title: string; type: string; stage: TicketStage; customer_name: string | null }[];
  customers: { id: string; business_name: string }[];
}) {
  return (
    <Layout title="Tickets" actor={props.actor} path={props.path} csrf={props.csrf} notice={props.notice}>
      <p class="kicker">QA / Dev</p>
      <h1>Ticket board</h1>
      <div class="board">
        {TICKET_STAGES.map((stage) => (
          <section class="lane" id={stage}>
            <h2>{stage}</h2>
            {props.tickets
              .filter((t) => t.stage === stage)
              .map((ticket) => (
                <article class="card">
                  <a href={`/admin/tickets/${ticket.id}`}>{ticket.title}</a>
                  <small>
                    {ticket.type}
                    {ticket.customer_name ? ` · ${ticket.customer_name}` : " · internal"}
                  </small>
                  {allowedTransitions(ticket.stage).length > 0 ? (
                    <form class="move" method="post" action={`/admin/tickets/${ticket.id}/transition`}>
                      <Csrf token={props.csrf} />
                      <input type="hidden" name="return_to" value="board" />
                      <label>
                        <span class="visually-hidden">Move {ticket.title} to</span>
                        <select name="to" required>
                          <option value="">Move…</option>
                          {allowedTransitions(ticket.stage).map((next) => (
                            <option value={next}>{next}</option>
                          ))}
                        </select>
                      </label>
                      <button type="submit" aria-label={`Go, move ${ticket.title}`}>
                        Go
                      </button>
                    </form>
                  ) : ticket.stage === "in-qa" ? (
                    <p class="hint">
                      <a href={`/admin/tickets/${ticket.id}`}>Submit QA</a>
                    </p>
                  ) : null}
                </article>
              ))}
          </section>
        ))}
      </div>
      <form class="panel stack narrow" method="post" action="/admin/tickets">
        <h2>New ticket</h2>
        <Csrf token={props.csrf} />
        <label>
          Title
          <input name="title" required />
        </label>
        <label>
          Type
          <select name="type">
            <option value="dev">dev</option>
            <option value="task">task</option>
          </select>
        </label>
        <label>
          Customer
          <select name="customer_id">
            <option value="">Internal</option>
            {props.customers.map((cust) => (
              <option value={cust.id}>{cust.business_name}</option>
            ))}
          </select>
        </label>
        <label>
          Description
          <textarea name="description" rows={3} />
        </label>
        <button class="btn" type="submit">
          Add to backlog
        </button>
      </form>
    </Layout>
  );
}

export function TicketDetailPage(props: {
  actor: Actor;
  path: string;
  csrf: string;
  ticket: {
    id: string;
    title: string;
    description: string | null;
    type: string;
    stage: TicketStage;
    customer_id: string | null;
    customer_name: string | null;
    qa_by: string | null;
    qa_result: string | null;
    qa_date: string | null;
    qa_notes: string | null;
  };
  history: Record<string, unknown>[];
  error?: string;
}) {
  const t = props.ticket;
  return (
    <Layout title={t.title} actor={props.actor} path={props.path} csrf={props.csrf} error={props.error}>
      <p class="kicker">
        <a href="/admin/tickets">Tickets</a>
      </p>
      <h1>{t.title}</h1>
      <p class="lede">
        {t.type} · <span class="pill">{t.stage}</span>
        {t.customer_name ? (
          <>
            {" "}
            · <a href={`/admin/customers/${t.customer_id}`}>{t.customer_name}</a>
          </>
        ) : (
          " · internal"
        )}
      </p>
      <p>{t.description ?? ""}</p>
      <div class="grid-2">
        <section class="panel stack">
          <h2>Move</h2>
          {allowedTransitions(t.stage).length > 0 ? (
            <form method="post" action={`/admin/tickets/${t.id}/transition`}>
              <Csrf token={props.csrf} />
              <label>
                Stage
                <select name="to" required>
                  {allowedTransitions(t.stage).map((next) => (
                    <option value={next}>{next}</option>
                  ))}
                </select>
              </label>
              <label>
                Note
                <input name="note" />
              </label>
              <button class="btn" type="submit">
                Update stage
              </button>
            </form>
          ) : (
            <p class="hint">This ticket can only leave in-qa through the QA form.</p>
          )}
          {t.stage === "in-qa" ? (
            <form class="muted-box stack" method="post" action={`/admin/tickets/${t.id}/qa`}>
              <h3>QA pass</h3>
              <Csrf token={props.csrf} />
              <label>
                Result
                <select name="result" required>
                  <option value="pass">pass → needs-adam</option>
                  <option value="fail">fail → in-dev</option>
                </select>
              </label>
              <label>
                Notes
                <textarea name="notes" rows={3} />
              </label>
              <button class="btn secondary" type="submit">
                Submit QA
              </button>
            </form>
          ) : (
            <p class="hint">QA fields unlock when the ticket is in-qa.</p>
          )}
          {t.qa_result ? (
            <p>
              Last QA: <strong>{t.qa_result}</strong> on {when(t.qa_date)} — {t.qa_notes ?? ""}
            </p>
          ) : null}
        </section>
        <section class="panel">
          <h2>History</h2>
          <ol class="history">
            {props.history.map((h) => (
              <li>
                <strong>
                  {String(h.from_stage ?? "—")} → {String(h.to_stage)}
                </strong>
                <small>
                  {String(h.actor_name ?? "system")} · {whenTime(String(h.created_at))}
                </small>
                {h.note ? <p>{String(h.note)}</p> : null}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Layout>
  );
}

export function HistoryPage(props: {
  actor: Actor;
  path: string;
  csrf: string;
  rows: Record<string, unknown>[];
}) {
  return (
    <Layout title="Dev history" actor={props.actor} path={props.path} csrf={props.csrf}>
      <p class="kicker">Closed dev work</p>
      <h1>History of work done</h1>
      {props.rows.length === 0 ? (
        <Empty>Nothing closed yet.</Empty>
      ) : (
        <table class="table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Customer</th>
              <th>QA</th>
              <th>Closed</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row) => (
              <tr>
                <td>
                  <a href={`/admin/tickets/${row.id}`}>{String(row.title)}</a>
                </td>
                <td>{String(row.customer_name ?? "internal")}</td>
                <td>{String(row.qa_result ?? "—")}</td>
                <td>{when(row.closed_at as string | null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
}

export function TemplatesPage(props: {
  actor: Actor;
  path: string;
  csrf: string;
  templates: Record<string, unknown>[];
}) {
  return (
    <Layout title="Templates" actor={props.actor} path={props.path} csrf={props.csrf}>
      <p class="kicker">Site catalog</p>
      <h1>Website templates</h1>
      <ul class="flag-cards">
        {props.templates.map((t) => (
          <li class="panel">
            <h2>{String(t.name)}</h2>
            <p class="mono">{String(t.slug)}</p>
            <p>{String(t.description ?? "")}</p>
            {t.preview_url ? <a href={String(t.preview_url)}>{String(t.preview_url)}</a> : null}
          </li>
        ))}
      </ul>
    </Layout>
  );
}
