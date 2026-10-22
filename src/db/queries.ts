import { nowIso } from "../auth/crypto";
import { assertAllowedSecretsRef } from "../domain/social";
import {
  assertCanSubmitQa,
  assertCanTransition,
  stageAfterQa,
  type QaResult,
  type TicketStage,
  type TicketType,
} from "../domain/tickets";

export type CustomerRow = {
  id: string;
  business_name: string;
  contact_name: string;
  contact_email: string;
  phone: string | null;
  city: string | null;
  county: string;
  notes: string | null;
  external_crm_name: string | null;
  external_crm_url: string | null;
  created_at: string;
  updated_at: string;
};

export type PackageRow = {
  id: string;
  product_line: string;
  name: string;
  slug: string;
  setup_price_cents: number;
  monthly_price_cents: number;
  description: string | null;
};

export type SubscriptionRow = {
  id: string;
  customer_id: string;
  package_id: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_payment_link_id: string | null;
  current_period_end: string | null;
};

export type TicketRow = {
  id: string;
  customer_id: string | null;
  title: string;
  description: string | null;
  type: TicketType;
  stage: TicketStage;
  assigned_to: string | null;
  qa_by: string | null;
  qa_result: QaResult | null;
  qa_date: string | null;
  qa_notes: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  customer_name: string | null;
};

export async function listCustomers(db: D1Database) {
  return db
    .prepare(
      `SELECT c.*,
              p.name AS package_name,
              p.product_line,
              s.status AS subscription_status,
              (SELECT COUNT(*) FROM flags f WHERE f.customer_id = c.id AND f.status = 'open') AS open_flags
       FROM customers c
       LEFT JOIN subscriptions s ON s.customer_id = c.id
       LEFT JOIN packages p ON p.id = s.package_id
       ORDER BY c.business_name`,
    )
    .all<
      CustomerRow & {
        package_name: string | null;
        product_line: string | null;
        subscription_status: string | null;
        open_flags: number;
      }
    >();
}

export async function getCustomer(db: D1Database, id: string) {
  return db.prepare("SELECT * FROM customers WHERE id = ?").bind(id).first<CustomerRow>();
}

export async function createCustomer(
  db: D1Database,
  input: {
    businessName: string;
    contactName: string;
    contactEmail: string;
    phone?: string;
    city?: string;
    packageId?: string;
  },
): Promise<string> {
  if (!input.businessName.trim() || !input.contactName.trim() || !input.contactEmail.includes("@")) {
    throw new Error("Business name, contact name, and a valid email are required");
  }
  const id = crypto.randomUUID();
  const ts = nowIso();
  await db
    .prepare(
      `INSERT INTO customers (id, business_name, contact_name, contact_email, phone, city, county, notes, external_crm_name, external_crm_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'Tooele', NULL, NULL, NULL, ?, ?)`,
    )
    .bind(
      id,
      input.businessName,
      input.contactName,
      input.contactEmail.toLowerCase(),
      input.phone ?? null,
      input.city ?? null,
      ts,
      ts,
    )
    .run();

  if (input.packageId) {
    await db
      .prepare(
        `INSERT INTO subscriptions (id, customer_id, package_id, status, stripe_customer_id, stripe_subscription_id, stripe_payment_link_id, current_period_end, created_at, updated_at)
         VALUES (?, ?, ?, 'active', NULL, NULL, NULL, NULL, ?, ?)`,
      )
      .bind(crypto.randomUUID(), id, input.packageId, ts, ts)
      .run();
  }
  return id;
}

export async function getSubscriptionForCustomer(db: D1Database, customerId: string) {
  return db
    .prepare(
      `SELECT s.*, p.name AS package_name, p.product_line, p.setup_price_cents, p.monthly_price_cents, p.description AS package_description
       FROM subscriptions s
       JOIN packages p ON p.id = s.package_id
       WHERE s.customer_id = ?`,
    )
    .bind(customerId)
    .first<
      SubscriptionRow & {
        package_name: string;
        product_line: string;
        setup_price_cents: number;
        monthly_price_cents: number;
        package_description: string | null;
      }
    >();
}

export async function listPayments(db: D1Database, customerId: string) {
  return db
    .prepare(
      `SELECT * FROM payments WHERE customer_id = ? ORDER BY created_at DESC`,
    )
    .bind(customerId)
    .all();
}

export async function listWebsites(db: D1Database, customerId: string) {
  return db
    .prepare(
      `SELECT w.*, t.name AS template_name
       FROM websites w
       LEFT JOIN website_templates t ON t.id = w.template_id
       WHERE w.customer_id = ?
       ORDER BY w.created_at`,
    )
    .bind(customerId)
    .all();
}

export async function listTemplates(db: D1Database) {
  return db
    .prepare("SELECT * FROM website_templates ORDER BY name")
    .all();
}

export async function listSocialAccounts(db: D1Database, customerId: string) {
  return db
    .prepare(
      `SELECT id, customer_id, platform, access_status, owner_email, last_verified_at, secrets_manager_ref, notes
       FROM social_accounts
       WHERE customer_id = ?
       ORDER BY platform`,
    )
    .bind(customerId)
    .all<{
      id: string;
      customer_id: string;
      platform: string;
      access_status: string;
      owner_email: string | null;
      last_verified_at: string | null;
      secrets_manager_ref: string | null;
      notes: string | null;
    }>();
}

/** Portal-only: never select vault pointers. Admin uses listSocialAccounts. */
export const PORTAL_SOCIAL_COLUMNS =
  "id, customer_id, platform, access_status, owner_email, last_verified_at, notes";

export async function listPortalSocialAccounts(db: D1Database, customerId: string) {
  return db
    .prepare(
      `SELECT ${PORTAL_SOCIAL_COLUMNS}
       FROM social_accounts
       WHERE customer_id = ?
       ORDER BY platform`,
    )
    .bind(customerId)
    .all<{
      id: string;
      customer_id: string;
      platform: string;
      access_status: string;
      owner_email: string | null;
      last_verified_at: string | null;
      notes: string | null;
    }>();
}

export async function upsertSocialAccount(
  db: D1Database,
  input: {
    customerId: string;
    platform: string;
    accessStatus: string;
    ownerEmail?: string;
    secretsManagerRef?: string | null;
    notes?: string;
  },
): Promise<void> {
  assertAllowedSecretsRef(input.secretsManagerRef);
  await db
    .prepare(
      `INSERT INTO social_accounts (id, customer_id, platform, access_status, owner_email, last_verified_at, secrets_manager_ref, notes)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
       ON CONFLICT(customer_id, platform) DO UPDATE SET
         access_status = excluded.access_status,
         owner_email = excluded.owner_email,
         secrets_manager_ref = excluded.secrets_manager_ref,
         notes = excluded.notes`,
    )
    .bind(
      crypto.randomUUID(),
      input.customerId,
      input.platform,
      input.accessStatus,
      input.ownerEmail ?? null,
      input.secretsManagerRef ?? null,
      input.notes ?? null,
    )
    .run();
}

export async function getGbp(db: D1Database, customerId: string) {
  return db
    .prepare("SELECT * FROM gbp_profiles WHERE customer_id = ?")
    .bind(customerId)
    .first();
}

export async function listSeo(db: D1Database, customerId: string) {
  return db
    .prepare(
      `SELECT * FROM seo_snapshots WHERE customer_id = ? ORDER BY captured_at DESC, keyword`,
    )
    .bind(customerId)
    .all();
}

export async function listCalls(db: D1Database, customerId: string) {
  return db
    .prepare(
      `SELECT * FROM call_logs WHERE customer_id = ? ORDER BY started_at DESC`,
    )
    .bind(customerId)
    .all();
}

export async function callStats(db: D1Database, customerId: string) {
  return db
    .prepare(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(duration_seconds), 0) AS total_seconds,
              COALESCE(AVG(duration_seconds), 0) AS avg_seconds
       FROM call_logs
       WHERE customer_id = ?`,
    )
    .bind(customerId)
    .first<{ count: number; total_seconds: number; avg_seconds: number }>();
}

export async function listReviews(db: D1Database, customerId: string) {
  return db
    .prepare(
      `SELECT * FROM review_items WHERE customer_id = ? ORDER BY received_at DESC`,
    )
    .bind(customerId)
    .all();
}

export async function listMessages(db: D1Database, customerId: string) {
  return db
    .prepare(
      `SELECT * FROM messages WHERE customer_id = ? ORDER BY created_at DESC`,
    )
    .bind(customerId)
    .all();
}

export async function createMessage(
  db: D1Database,
  input: {
    customerId: string;
    fromRole: "admin" | "customer";
    subject: string;
    body: string;
    flag?: boolean;
    flagReason?: string;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  const ts = nowIso();
  await db
    .prepare(
      `INSERT INTO messages (id, customer_id, from_role, subject, body, created_at, is_flagged, flag_reason, flag_resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    )
    .bind(
      id,
      input.customerId,
      input.fromRole,
      input.subject,
      input.body,
      ts,
      input.flag ? 1 : 0,
      input.flag ? (input.flagReason ?? "Flagged") : null,
    )
    .run();

  if (input.flag) {
    await db
      .prepare(
        `INSERT INTO flags (id, customer_id, message_id, kind, severity, title, detail, status, created_at, resolved_at)
         VALUES (?, ?, ?, 'message', 'warn', ?, ?, 'open', ?, NULL)`,
      )
      .bind(crypto.randomUUID(), input.customerId, id, input.subject, input.body, ts)
      .run();
  }
  return id;
}

export async function listOpenFlags(db: D1Database) {
  return db
    .prepare(
      `SELECT f.*, c.business_name
       FROM flags f
       JOIN customers c ON c.id = f.customer_id
       WHERE f.status = 'open'
       ORDER BY CASE f.severity WHEN 'urgent' THEN 0 WHEN 'warn' THEN 1 ELSE 2 END, f.created_at DESC`,
    )
    .all();
}

export async function resolveFlag(db: D1Database, flagId: string): Promise<void> {
  const ts = nowIso();
  await db
    .prepare("UPDATE flags SET status = 'resolved', resolved_at = ? WHERE id = ?")
    .bind(ts, flagId)
    .run();
  const flag = await db
    .prepare("SELECT message_id FROM flags WHERE id = ?")
    .bind(flagId)
    .first<{ message_id: string | null }>();
  if (flag?.message_id) {
    await db
      .prepare("UPDATE messages SET flag_resolved_at = ? WHERE id = ?")
      .bind(ts, flag.message_id)
      .run();
  }
}

export async function listTickets(db: D1Database, customerId?: string) {
  const sql = customerId
    ? `SELECT t.*, c.business_name AS customer_name
       FROM tickets t
       LEFT JOIN customers c ON c.id = t.customer_id
       WHERE t.customer_id = ?
       ORDER BY t.updated_at DESC`
    : `SELECT t.*, c.business_name AS customer_name
       FROM tickets t
       LEFT JOIN customers c ON c.id = t.customer_id
       ORDER BY t.updated_at DESC`;
  const stmt = db.prepare(sql);
  return (customerId ? stmt.bind(customerId) : stmt).all<TicketRow>();
}

export async function getTicket(db: D1Database, id: string) {
  return db
    .prepare(
      `SELECT t.*, c.business_name AS customer_name
       FROM tickets t
       LEFT JOIN customers c ON c.id = t.customer_id
       WHERE t.id = ?`,
    )
    .bind(id)
    .first<TicketRow>();
}

export async function listTicketHistory(db: D1Database, ticketId: string) {
  return db
    .prepare(
      `SELECT h.*, u.display_name AS actor_name
       FROM ticket_history h
       LEFT JOIN users u ON u.id = h.actor_user_id
       WHERE h.ticket_id = ?
       ORDER BY h.created_at`,
    )
    .bind(ticketId)
    .all();
}

export async function createTicket(
  db: D1Database,
  input: {
    title: string;
    description?: string;
    type: TicketType;
    customerId?: string | null;
    actorUserId: string;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  const ts = nowIso();
  await db
    .prepare(
      `INSERT INTO tickets (id, customer_id, title, description, type, stage, assigned_to, qa_by, qa_result, qa_date, qa_notes, created_at, updated_at, closed_at)
       VALUES (?, ?, ?, ?, ?, 'backlog', NULL, NULL, NULL, NULL, NULL, ?, ?, NULL)`,
    )
    .bind(id, input.customerId ?? null, input.title, input.description ?? null, input.type, ts, ts)
    .run();
  await db
    .prepare(
      `INSERT INTO ticket_history (id, ticket_id, from_stage, to_stage, actor_user_id, note, created_at)
       VALUES (?, ?, NULL, 'backlog', ?, 'Created', ?)`,
    )
    .bind(crypto.randomUUID(), id, input.actorUserId, ts)
    .run();
  return id;
}

export async function transitionTicket(
  db: D1Database,
  input: { ticketId: string; to: TicketStage; actorUserId: string; note?: string },
): Promise<TicketRow> {
  const ticket = await getTicket(db, input.ticketId);
  if (!ticket) {
    throw new Error("Ticket not found");
  }
  assertCanTransition(ticket.stage, input.to);
  const ts = nowIso();
  const closedAt = input.to === "closed" ? ts : null;
  await db
    .prepare(
      `UPDATE tickets
       SET stage = ?, updated_at = ?, closed_at = ?, qa_result = CASE WHEN ? = 'in-qa' THEN NULL ELSE qa_result END
       WHERE id = ?`,
    )
    .bind(input.to, ts, closedAt, input.to, input.ticketId)
    .run();
  await db
    .prepare(
      `INSERT INTO ticket_history (id, ticket_id, from_stage, to_stage, actor_user_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.ticketId,
      ticket.stage,
      input.to,
      input.actorUserId,
      input.note ?? null,
      ts,
    )
    .run();
  const updated = await getTicket(db, input.ticketId);
  if (!updated) {
    throw new Error("Ticket missing after update");
  }
  return updated;
}

export async function submitQa(
  db: D1Database,
  input: { ticketId: string; result: QaResult; actorUserId: string; notes?: string },
): Promise<TicketRow> {
  const ticket = await getTicket(db, input.ticketId);
  if (!ticket) {
    throw new Error("Ticket not found");
  }
  assertCanSubmitQa(ticket.stage);
  const next = stageAfterQa(input.result);
  const ts = nowIso();
  await db
    .prepare(
      `UPDATE tickets
       SET stage = ?, qa_by = ?, qa_result = ?, qa_date = ?, qa_notes = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(next, input.actorUserId, input.result, ts, input.notes ?? null, ts, input.ticketId)
    .run();
  await db
    .prepare(
      `INSERT INTO ticket_history (id, ticket_id, from_stage, to_stage, actor_user_id, note, created_at)
       VALUES (?, ?, 'in-qa', ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.ticketId,
      next,
      input.actorUserId,
      `QA ${input.result}${input.notes ? `: ${input.notes}` : ""}`,
      ts,
    )
    .run();
  const updated = await getTicket(db, input.ticketId);
  if (!updated) {
    throw new Error("Ticket missing after QA");
  }
  return updated;
}

export async function listPackages(db: D1Database) {
  return db.prepare("SELECT * FROM packages ORDER BY sort_order").all<PackageRow>();
}

export async function listDevHistory(db: D1Database) {
  return db
    .prepare(
      `SELECT t.id, t.title, t.type, t.stage, t.qa_result, t.qa_date, t.closed_at, t.updated_at,
              c.business_name AS customer_name
       FROM tickets t
       LEFT JOIN customers c ON c.id = t.customer_id
       WHERE t.type = 'dev' AND t.stage = 'closed'
       ORDER BY t.closed_at DESC`,
    )
    .all();
}

export async function dashboardCounts(db: D1Database) {
  const customers = await db.prepare("SELECT COUNT(*) AS n FROM customers").first<{ n: number }>();
  const flags = await db
    .prepare("SELECT COUNT(*) AS n FROM flags WHERE status = 'open'")
    .first<{ n: number }>();
  const openTickets = await db
    .prepare("SELECT COUNT(*) AS n FROM tickets WHERE stage != 'closed'")
    .first<{ n: number }>();
  const pastDue = await db
    .prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE status = 'past_due'")
    .first<{ n: number }>();
  return {
    customers: customers?.n ?? 0,
    openFlags: flags?.n ?? 0,
    openTickets: openTickets?.n ?? 0,
    pastDue: pastDue?.n ?? 0,
  };
}

export async function findUserByEmail(db: D1Database, email: string) {
  return db
    .prepare("SELECT id, email, display_name, role, customer_id FROM users WHERE email = ?")
    .bind(email.trim().toLowerCase())
    .first<{
      id: string;
      email: string;
      display_name: string;
      role: "admin" | "customer";
      customer_id: string | null;
    }>();
}

export async function listKnownDevLogins(db: D1Database) {
  return db
    .prepare("SELECT email, display_name, role FROM users ORDER BY role, display_name")
    .all<{ email: string; display_name: string; role: string }>();
}
