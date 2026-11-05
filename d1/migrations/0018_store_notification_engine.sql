-- PhoneYa2 storefront notification and customer-event foundation.
-- Visitor identity is an opaque browser-generated ID; no contact details are stored here.
CREATE TABLE IF NOT EXISTS store_notifications (
 id TEXT PRIMARY KEY,event_key TEXT NOT NULL UNIQUE,category TEXT NOT NULL,kind TEXT NOT NULL DEFAULT 'event',
 title TEXT NOT NULL,message TEXT NOT NULL DEFAULT '',destination TEXT NOT NULL DEFAULT '/',priority TEXT NOT NULL DEFAULT 'normal',
 metadata_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),expires_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_store_notifications_created ON store_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_notifications_category ON store_notifications(category,created_at DESC);
CREATE TABLE IF NOT EXISTS store_notification_snapshots (
 source_type TEXT NOT NULL,source_id TEXT NOT NULL,price_minor INTEGER,stock INTEGER,content_hash TEXT NOT NULL DEFAULT '',
 checked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),PRIMARY KEY(source_type,source_id)
);
CREATE TABLE IF NOT EXISTS store_notification_state (source_type TEXT PRIMARY KEY,baseline_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS store_visitor_events (
 id TEXT PRIMARY KEY,visitor_id TEXT NOT NULL,event_type TEXT NOT NULL,event_key TEXT NOT NULL UNIQUE,payload_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_store_visitor_events_visitor ON store_visitor_events(visitor_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_visitor_events_type ON store_visitor_events(event_type,created_at DESC);
CREATE TABLE IF NOT EXISTS store_cart_sessions (
 visitor_id TEXT PRIMARY KEY,cart_json TEXT NOT NULL DEFAULT '[]',updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_store_cart_sessions_expiry ON store_cart_sessions(expires_at);
