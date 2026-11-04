-- Partner-scoped notifications and persistent onboarding guidance.
-- Each partner can only read or update rows belonging to their advertiser account.
CREATE TABLE IF NOT EXISTS partner_notifications (
  id TEXT PRIMARY KEY,
  advertiser_id TEXT NOT NULL,
  event_key TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'guidance',
  kind TEXT NOT NULL DEFAULT 'event',
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normal',
  destination TEXT NOT NULL DEFAULT 'overview',
  action_label TEXT NOT NULL DEFAULT 'Open',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0,1)),
  read_at TEXT,
  dismissed_at TEXT,
  completed_at TEXT,
  UNIQUE(advertiser_id,event_key),
  FOREIGN KEY(advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_partner_notifications_unread
  ON partner_notifications(advertiser_id,is_read,dismissed_at,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_notifications_category
  ON partner_notifications(advertiser_id,category,created_at DESC);

-- Stores one-time onboarding baselines and the last package seen by the partner workspace.
CREATE TABLE IF NOT EXISTS partner_notification_state (
  advertiser_id TEXT NOT NULL,
  state_key TEXT NOT NULL,
  state_value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(advertiser_id,state_key),
  FOREIGN KEY(advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS partner_notification_seen (
  advertiser_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(advertiser_id,entity_type,entity_id),
  FOREIGN KEY(advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
);
