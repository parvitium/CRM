-- Parvitium CRM foundation schema.
-- Social credentials: NEVER store passwords or access tokens in this database.
-- social_accounts.secrets_manager_ref is a 1Password pointer only (op://).

CREATE TABLE packages (
  id TEXT PRIMARY KEY,
  product_line TEXT NOT NULL CHECK (product_line IN ('parvitium', 'tooele_trades')),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  setup_price_cents INTEGER NOT NULL DEFAULT 0,
  monthly_price_cents INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE website_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  preview_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('parvitium', 'tooele_trades', 'both')),
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  county TEXT NOT NULL DEFAULT 'Tooele',
  notes TEXT,
  external_crm_name TEXT,
  external_crm_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Admin-only. Cloudflare Access maps a verified JWT email to a row here.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role = 'admin'),
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE outbound_emails (
  id TEXT PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL REFERENCES packages(id),
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_payment_link_id TEXT,
  current_period_end TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (customer_id, package_id)
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  subscription_id TEXT REFERENCES subscriptions(id),
  stripe_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  paid_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE websites (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES website_templates(id),
  name TEXT NOT NULL,
  url TEXT,
  status TEXT NOT NULL CHECK (status IN ('planned', 'in_progress', 'live', 'paused')),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE social_accounts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'x', 'tiktok', 'youtube')),
  access_status TEXT NOT NULL CHECK (
    access_status IN ('none', 'requested', 'partner_granted', 'delegated', 'expired')
  ),
  owner_email TEXT,
  last_verified_at TEXT,
  -- Pointer only. Example: op://Parvitium/summit-ridge-facebook
  -- Never a password, cookie, or OAuth token. 1Password only.
  secrets_manager_ref TEXT CHECK (
    secrets_manager_ref IS NULL
    OR secrets_manager_ref LIKE 'op://%'
  ),
  notes TEXT,
  UNIQUE (customer_id, platform)
);

CREATE TABLE gbp_profiles (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  place_id TEXT,
  name TEXT,
  address TEXT,
  phone TEXT,
  maps_url TEXT,
  rating REAL,
  review_count INTEGER,
  last_synced_at TEXT
);

CREATE TABLE seo_snapshots (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  website_id TEXT REFERENCES websites(id),
  captured_at TEXT NOT NULL,
  keyword TEXT NOT NULL,
  search_engine TEXT NOT NULL DEFAULT 'google',
  rank INTEGER,
  ai_citation_score REAL,
  ai_citation_notes TEXT,
  source TEXT NOT NULL DEFAULT 'mock'
);

CREATE TABLE call_logs (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  external_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT,
  to_number TEXT,
  started_at TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  disposition TEXT,
  transcript_preview TEXT,
  -- R2 object key once recordings are enabled. Not a URL with credentials.
  recording_r2_key TEXT
);

CREATE TABLE review_items (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('google', 'facebook', 'yelp')),
  author_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL,
  received_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('new', 'drafted', 'posted', 'skipped')),
  draft_reply TEXT,
  posted_at TEXT
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  from_role TEXT NOT NULL CHECK (from_role IN ('admin', 'customer')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  is_flagged INTEGER NOT NULL DEFAULT 0 CHECK (is_flagged IN (0, 1)),
  flag_reason TEXT,
  flag_resolved_at TEXT
);

CREATE TABLE flags (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES messages(id),
  kind TEXT NOT NULL CHECK (
    kind IN (
      'message',
      'payment_past_due',
      'gbp_disconnected',
      'review_needs_reply',
      'seo_drop',
      'call_spike',
      'other'
    )
  ),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warn', 'urgent')),
  title TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE tickets (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('dev', 'task')),
  stage TEXT NOT NULL CHECK (
    stage IN ('backlog', 'ready', 'in-dev', 'in-qa', 'needs-adam', 'closed')
  ),
  assigned_to TEXT REFERENCES users(id),
  qa_by TEXT REFERENCES users(id),
  qa_result TEXT CHECK (qa_result IN ('pass', 'fail')),
  qa_date TEXT,
  qa_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE TABLE ticket_history (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users(id),
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_customers_kind ON customers(kind, business_name);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX idx_payments_customer ON payments(customer_id);
CREATE INDEX idx_websites_customer ON websites(customer_id);
CREATE INDEX idx_social_customer ON social_accounts(customer_id);
CREATE INDEX idx_seo_customer ON seo_snapshots(customer_id, captured_at);
CREATE INDEX idx_calls_customer ON call_logs(customer_id, started_at);
CREATE INDEX idx_reviews_customer ON review_items(customer_id, received_at);
CREATE INDEX idx_messages_customer ON messages(customer_id, created_at);
CREATE INDEX idx_flags_status ON flags(status, created_at);
CREATE INDEX idx_tickets_stage ON tickets(stage, updated_at);
CREATE INDEX idx_ticket_history_ticket ON ticket_history(ticket_id, created_at);
