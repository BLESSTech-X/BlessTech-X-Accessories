-- PhoneYa2 unified communications on Cloudflare D1.
-- All newsletter, campaign, automation and product-announcement records live in D1.
-- Existing order and activity records are preserved.

ALTER TABLE email_activity ADD COLUMN campaign_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_email_activity_campaign ON email_activity(campaign_id,status);
CREATE INDEX IF NOT EXISTS idx_email_activity_type_product ON email_activity(event_type,related_product_slug,status);

CREATE TABLE IF NOT EXISTS customer_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','subscribed','unsubscribed','bounced')),
  consent_source TEXT NOT NULL DEFAULT '',
  preferences_json TEXT NOT NULL DEFAULT '{"new_arrivals":true,"offers":true,"tips":true}',
  confirmation_token TEXT UNIQUE,
  confirmation_sent_at TEXT,
  consented_at TEXT,
  unsubscribed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_customer_subscribers_status ON customer_subscribers(status,created_at);
CREATE INDEX IF NOT EXISTS idx_customer_subscribers_email ON customer_subscribers(email COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sending','sent','failed')),
  audience TEXT NOT NULL DEFAULT 'subscribed' CHECK(audience IN ('subscribed','partners')),
  message_type TEXT NOT NULL DEFAULT 'marketing' CHECK(message_type IN ('marketing','service')),
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_created ON email_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status,updated_at DESC);

CREATE TABLE IF NOT EXISTS communication_automations (
  automation_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  approval_required INTEGER NOT NULL DEFAULT 1 CHECK(approval_required IN (0,1)),
  config_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT OR IGNORE INTO communication_automations(automation_key,name,description,enabled,approval_required,config_json) VALUES
 ('customer_order_confirmation','Customer order confirmation','Send a transactional email after an order is saved.',1,0,'{"type":"transactional"}'),
 ('new_product_announcement','New-product announcements','Prepare announcements when new products are published. Only confirmed subscribers receive marketing email.',0,1,'{"audience":"subscribers","deduplicate":true}'),
 ('back_in_stock','Back-in-stock alerts','Notify subscribers who requested a product availability alert.',0,1,'{"audience":"product_watchers"}'),
 ('customer_follow_up','Customer follow-ups','Schedule relevant post-purchase communications.',0,1,'{"frequency_cap_days":14}');

CREATE TABLE IF NOT EXISTS product_announcement_jobs (
  id TEXT PRIMARY KEY,
  product_slug TEXT NOT NULL UNIQUE,
  product_title TEXT NOT NULL,
  product_price REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','disabled','failed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_product_announcement_jobs_status ON product_announcement_jobs(status,created_at DESC);
