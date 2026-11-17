CREATE TABLE IF NOT EXISTS campaign_send_locks (
  campaign_id TEXT PRIMARY KEY,
  lock_token TEXT NOT NULL,
  locked_until TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_campaign_send_locks_expiry
  ON campaign_send_locks(locked_until);
