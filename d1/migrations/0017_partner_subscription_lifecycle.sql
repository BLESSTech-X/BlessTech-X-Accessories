-- Partner subscription lifecycle: explicit paid terms, audit history and reminder deduplication.
ALTER TABLE partner_subscriptions ADD COLUMN paid_months INTEGER NOT NULL DEFAULT 1;
ALTER TABLE partner_subscriptions ADD COLUMN payment_reference TEXT NOT NULL DEFAULT '';
ALTER TABLE partner_subscriptions ADD COLUMN admin_note TEXT NOT NULL DEFAULT '';
ALTER TABLE partner_subscriptions ADD COLUMN activated_by TEXT NOT NULL DEFAULT '';
ALTER TABLE partner_subscriptions ADD COLUMN ended_at TEXT;

CREATE INDEX IF NOT EXISTS idx_partner_subscriptions_deadline
  ON partner_subscriptions(status, package_key, current_period_end);

CREATE TABLE IF NOT EXISTS partner_subscription_events (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  advertiser_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  package_key TEXT NOT NULL DEFAULT '',
  paid_months INTEGER NOT NULL DEFAULT 0,
  amount_minor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZMW',
  starts_at TEXT,
  ends_at TEXT,
  note TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(subscription_id) REFERENCES partner_subscriptions(id) ON DELETE CASCADE,
  FOREIGN KEY(advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_partner_subscription_events_owner
  ON partner_subscription_events(advertiser_id, created_at DESC);

CREATE TABLE IF NOT EXISTS partner_subscription_reminders (
  subscription_id TEXT NOT NULL,
  advertiser_id TEXT NOT NULL,
  days_before_end INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
  attempted_at TEXT,
  sent_at TEXT,
  provider_message_id TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(subscription_id, days_before_end),
  FOREIGN KEY(subscription_id) REFERENCES partner_subscriptions(id) ON DELETE CASCADE,
  FOREIGN KEY(advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_partner_subscription_reminders_status
  ON partner_subscription_reminders(status, attempted_at);
