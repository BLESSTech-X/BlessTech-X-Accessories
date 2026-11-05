-- PhoneYa2 Command Centre prepared-work queue and campaign media.
-- Safe additive changes; existing campaign and notification records are preserved.
ALTER TABLE admin_notifications ADD COLUMN image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE email_campaigns ADD COLUMN source_key TEXT NOT NULL DEFAULT '';
ALTER TABLE email_campaigns ADD COLUMN hero_image_url TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_campaigns_source_key
 ON email_campaigns(source_key) WHERE source_key<>'';

CREATE TABLE IF NOT EXISTS admin_work_items (
 id TEXT PRIMARY KEY,
 source_key TEXT NOT NULL UNIQUE,
 category TEXT NOT NULL DEFAULT 'operations',
 title TEXT NOT NULL,
 message TEXT NOT NULL DEFAULT '',
 image_url TEXT NOT NULL DEFAULT '',
 destination TEXT NOT NULL DEFAULT '/admin/command-center.html',
 action_url TEXT NOT NULL DEFAULT '/admin/communications.html',
 priority TEXT NOT NULL DEFAULT 'normal',
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','ignored','completed')),
 related_id TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_work_items_status ON admin_work_items(status,priority,created_at DESC);
UPDATE communication_automations SET enabled=1,approval_required=1,
 config_json='{"audience":"subscribers","deduplicate":true,"requires_owner_approval":true}'
 WHERE automation_key='new_product_announcement';
