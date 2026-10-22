-- Sliding-window counters for magic-link issuance (per email + per IP).
-- Keys are hashed in application code; this table stores opaque bucket ids.
CREATE TABLE rate_limit_events (
  id TEXT PRIMARY KEY,
  bucket TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_rate_limit_events_bucket_time ON rate_limit_events(bucket, created_at);
