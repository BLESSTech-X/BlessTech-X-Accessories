-- Unified PhoneYa2 communication activity for SMS, email and partner notifications.
CREATE TABLE IF NOT EXISTS communication_activity (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL DEFAULT '',
  recipient TEXT NOT NULL DEFAULT '',
  recipient_name TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL CHECK (channel IN ('email','sms','whatsapp','push')),
  event_type TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('queued','sent','delivered','failed','skipped')),
  provider TEXT NOT NULL DEFAULT '',
  provider_message_id TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_communication_activity_campaign ON communication_activity(campaign_id,channel,status);
CREATE INDEX IF NOT EXISTS idx_communication_activity_recipient ON communication_activity(recipient,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communication_activity_created ON communication_activity(created_at DESC);
