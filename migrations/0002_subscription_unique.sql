-- One active commercial relationship per customer in this foundation.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_per_customer ON subscriptions(customer_id);
