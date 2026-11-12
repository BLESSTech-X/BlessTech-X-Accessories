-- PhoneYa2 Campaign Studio lifecycle and engagement foundation.
-- Additive only: existing campaigns, delivery logs and subscribers are preserved.
ALTER TABLE email_campaigns ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'pending' CHECK(approval_status IN ('pending','approved','rejected'));
ALTER TABLE email_campaigns ADD COLUMN approved_by TEXT NOT NULL DEFAULT '';
ALTER TABLE email_campaigns ADD COLUMN approved_at TEXT;
ALTER TABLE email_campaigns ADD COLUMN published_at TEXT;
ALTER TABLE email_campaigns ADD COLUMN starts_at TEXT;
ALTER TABLE email_campaigns ADD COLUMN ends_at TEXT;
ALTER TABLE email_campaigns ADD COLUMN channels_json TEXT NOT NULL DEFAULT '["email"]';
ALTER TABLE email_campaigns ADD COLUMN audience_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE email_campaigns ADD COLUMN destination_url TEXT NOT NULL DEFAULT '';
ALTER TABLE email_campaigns ADD COLUMN cta_label TEXT NOT NULL DEFAULT 'Shop now';
CREATE INDEX IF NOT EXISTS idx_email_campaigns_lifecycle ON email_campaigns(approval_status,published_at,starts_at,ends_at);

CREATE TABLE IF NOT EXISTS campaign_engagement (
 id TEXT PRIMARY KEY,
 campaign_id TEXT NOT NULL,
 event_type TEXT NOT NULL CHECK(event_type IN ('impression','click','conversion')),
 visitor_key TEXT NOT NULL DEFAULT '',
 placement TEXT NOT NULL DEFAULT '',
 source TEXT NOT NULL DEFAULT '',
 order_id TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 FOREIGN KEY(campaign_id) REFERENCES email_campaigns(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_campaign_engagement_campaign ON campaign_engagement(campaign_id,event_type,created_at);
CREATE INDEX IF NOT EXISTS idx_campaign_engagement_visitor ON campaign_engagement(campaign_id,visitor_key,event_type);
