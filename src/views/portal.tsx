import type { Child } from "hono/jsx";
import type { Actor } from "../domain/authz";
import { Csrf, Empty, Layout } from "./layout";
import { money, productLineLabel, when, whenTime } from "./format";

function PortalChrome(props: {
  title: string;
  actor: Actor;
  path: string;
  csrf: string;
  notice?: string;
  error?: string;
  children: Child;
}) {
  return (
    <Layout
      title={props.title}
      actor={props.actor}
      path={props.path}
      csrf={props.csrf}
      notice={props.notice}
      error={props.error}
    >
      {props.children}
    </Layout>
  );
}

export function PortalHome(props: {
  actor: Actor;
  path: string;
  csrf: string;
  customer: Record<string, unknown>;
  subscription: Record<string, unknown> | null;
  website: Record<string, unknown> | null;
  gbp: Record<string, unknown> | null;
  callStats: { count: number; total_seconds: number } | null;
  openReviews: number;
}) {
  return (
    <PortalChrome title="Your portal" actor={props.actor} path={props.path} csrf={props.csrf}>
      <p class="kicker">{String(props.customer.business_name)}</p>
      <h1>Welcome, {props.actor.displayName}</h1>
      <p class="lede">Read-mostly view of your Parvitium / TooeleTrades account.</p>
      <div class="stats">
        <a class="stat" href="/portal/package">
          <strong>{props.subscription ? String(props.subscription.package_name) : "—"}</strong>
          <span>Package</span>
        </a>
        <a class="stat" href="/portal/site">
          <strong>{props.website ? String(props.website.status) : "none"}</strong>
          <span>Website</span>
        </a>
        <a class="stat" href="/portal/calls">
          <strong>{props.callStats?.count ?? 0}</strong>
          <span>Calls logged</span>
        </a>
        <a class="stat" href="/portal/reviews">
          <strong>{props.openReviews}</strong>
          <span>Reviews in progress</span>
        </a>
      </div>
      {props.gbp ? (
        <p>
          Google rating: {props.gbp.rating == null ? "not listed yet" : `${String(props.gbp.rating)}★`}
        </p>
      ) : null}
    </PortalChrome>
  );
}

export function PortalPackage(props: {
  actor: Actor;
  path: string;
  csrf: string;
  subscription: Record<string, unknown> | null;
  payments: Record<string, unknown>[];
}) {
  return (
    <PortalChrome title="Package" actor={props.actor} path={props.path} csrf={props.csrf}>
      <h1>Package & payments</h1>
      {props.subscription ? (
        <section class="panel">
          <dl class="meta">
            <div>
              <dt>Plan</dt>
              <dd>
                {productLineLabel(String(props.subscription.product_line))} ·{" "}
                {String(props.subscription.package_name)}
              </dd>
            </div>
            <div>
              <dt>Monthly</dt>
              <dd>{money(Number(props.subscription.monthly_price_cents))}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <span class={`pill ${String(props.subscription.status)}`}>
                  {String(props.subscription.status)}
                </span>
              </dd>
            </div>
          </dl>
          <p class="hint">Card details live in Stripe. This screen only shows status and amounts.</p>
        </section>
      ) : (
        <Empty>No package on file. Message Adam if that looks wrong.</Empty>
      )}
      {props.payments.length > 0 ? (
        <table class="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {props.payments.map((p) => (
              <tr>
                <td>{when(String(p.created_at))}</td>
                <td>{money(Number(p.amount_cents))}</td>
                <td>{String(p.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </PortalChrome>
  );
}

export function PortalSite(props: {
  actor: Actor;
  path: string;
  csrf: string;
  websites: Record<string, unknown>[];
}) {
  return (
    <PortalChrome title="Website" actor={props.actor} path={props.path} csrf={props.csrf}>
      <h1>Website</h1>
      {props.websites.length === 0 ? (
        <Empty>No website recorded yet.</Empty>
      ) : (
        props.websites.map((site) => (
          <section class="panel">
            <h2>{String(site.name)}</h2>
            <p>
              {site.url ? (
                <a href={String(site.url)}>{String(site.url)}</a>
              ) : (
                "URL pending"
              )}
            </p>
            <p>
              Template: {String(site.template_name ?? "—")} · Status: {String(site.status)}
            </p>
          </section>
        ))
      )}
    </PortalChrome>
  );
}

export function PortalSocial(props: {
  actor: Actor;
  path: string;
  csrf: string;
  social: Record<string, unknown>[];
}) {
  return (
    <PortalChrome title="Social" actor={props.actor} path={props.path} csrf={props.csrf}>
      <h1>Social access</h1>
      <p class="hint">
        This is access status only — partner or delegated access, owner email, last verified.
        Passwords are not stored in this app.
      </p>
      {props.social.length === 0 ? (
        <Empty>No social accounts on file.</Empty>
      ) : (
        <table class="table">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Access</th>
              <th>Owner email</th>
              <th>Last verified</th>
            </tr>
          </thead>
          <tbody>
            {props.social.map((s) => (
              <tr>
                <td>{String(s.platform)}</td>
                <td>{String(s.access_status)}</td>
                <td>{String(s.owner_email ?? "—")}</td>
                <td>{when(s.last_verified_at as string | null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PortalChrome>
  );
}

export function PortalGbp(props: {
  actor: Actor;
  path: string;
  csrf: string;
  gbp: Record<string, unknown> | null;
}) {
  return (
    <PortalChrome title="Google" actor={props.actor} path={props.path} csrf={props.csrf}>
      <h1>Google Business Profile</h1>
      {props.gbp ? (
        <section class="panel">
          <p>{String(props.gbp.name ?? "")}</p>
          <p>{String(props.gbp.address ?? "")}</p>
          <p>
            Rating: {props.gbp.rating == null ? "—" : String(props.gbp.rating)} (
            {String(props.gbp.review_count ?? 0)} reviews)
          </p>
        </section>
      ) : (
        <Empty>Google profile is not connected yet.</Empty>
      )}
    </PortalChrome>
  );
}

export function PortalSeo(props: {
  actor: Actor;
  path: string;
  csrf: string;
  seo: Record<string, unknown>[];
}) {
  return (
    <PortalChrome title="SEO" actor={props.actor} path={props.path} csrf={props.csrf}>
      <h1>Page rank & AI citation</h1>
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
            </tr>
          </thead>
          <tbody>
            {props.seo.map((row) => (
              <tr>
                <td>{when(String(row.captured_at))}</td>
                <td>{String(row.keyword)}</td>
                <td>{row.rank == null ? "—" : String(row.rank)}</td>
                <td>{row.ai_citation_score == null ? "—" : String(row.ai_citation_score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PortalChrome>
  );
}

export function PortalCalls(props: {
  actor: Actor;
  path: string;
  csrf: string;
  calls: Record<string, unknown>[];
  stats: { count: number; total_seconds: number; avg_seconds: number } | null;
}) {
  return (
    <PortalChrome title="Calls" actor={props.actor} path={props.path} csrf={props.csrf}>
      <h1>AI receptionist</h1>
      <p class="lede">
        {props.stats
          ? `${props.stats.count} calls · ${Math.round(props.stats.total_seconds / 60)} minutes`
          : "No calls yet"}
      </p>
      {props.calls.length === 0 ? (
        <Empty>The call agent has not logged anything for you.</Empty>
      ) : (
        <table class="table">
          <thead>
            <tr>
              <th>When</th>
              <th>From</th>
              <th>Length</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {props.calls.map((call) => (
              <tr>
                <td>{whenTime(String(call.started_at))}</td>
                <td>{String(call.from_number ?? "—")}</td>
                <td>{String(call.duration_seconds)}s</td>
                <td>{String(call.disposition ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PortalChrome>
  );
}

export function PortalReviews(props: {
  actor: Actor;
  path: string;
  csrf: string;
  reviews: Record<string, unknown>[];
}) {
  return (
    <PortalChrome title="Reviews" actor={props.actor} path={props.path} csrf={props.csrf}>
      <h1>AI review manager</h1>
      {props.reviews.length === 0 ? (
        <Empty>No reviews imported.</Empty>
      ) : (
        <ul class="review-list">
          {props.reviews.map((rev) => (
            <li>
              <strong>
                {String(rev.rating)}★ · {String(rev.author_name)}
              </strong>
              <span class="pill">{String(rev.status)}</span>
              <p>{String(rev.body)}</p>
              {rev.draft_reply ? <blockquote>Draft reply: {String(rev.draft_reply)}</blockquote> : null}
            </li>
          ))}
        </ul>
      )}
    </PortalChrome>
  );
}

export function PortalMessages(props: {
  actor: Actor;
  path: string;
  csrf: string;
  notice?: string;
  messages: Record<string, unknown>[];
}) {
  return (
    <PortalChrome title="Messages" actor={props.actor} path={props.path} csrf={props.csrf} notice={props.notice}>
      <h1>Messages to Adam</h1>
      <form class="panel stack" method="post" action="/portal/messages">
        <Csrf token={props.csrf} />
        <label>
          Subject
          <input name="subject" required />
        </label>
        <label>
          Message
          <textarea name="body" required rows={4} />
        </label>
        <label class="check">
          <input type="checkbox" name="flag" value="1" />
          Flag as urgent for Adam
        </label>
        <button class="btn" type="submit">
          Send
        </button>
      </form>
      {props.messages.length === 0 ? (
        <Empty>No messages yet.</Empty>
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
    </PortalChrome>
  );
}
