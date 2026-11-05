-- Public Community notifications generated from newly published PhoneYa2 content.
-- Read state is browser-local because Community has no visitor account system.
CREATE TABLE IF NOT EXISTS community_notifications (
 id TEXT PRIMARY KEY,event_key TEXT NOT NULL UNIQUE,
 category TEXT NOT NULL CHECK(category IN ('community','offers','businesses','blog','products','system')),
 kind TEXT NOT NULL DEFAULT 'event' CHECK(kind IN ('event','system')),
 title TEXT NOT NULL,message TEXT NOT NULL DEFAULT '',destination TEXT NOT NULL DEFAULT '/community/',
 related_id TEXT NOT NULL DEFAULT '',related_label TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_community_notifications_created ON community_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_notifications_category ON community_notifications(category,created_at DESC);
CREATE TABLE IF NOT EXISTS community_notification_snapshots (
 source_type TEXT NOT NULL CHECK(source_type IN ('posts','offers','businesses','blog','products')),
 source_id TEXT NOT NULL,detected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 PRIMARY KEY(source_type,source_id)
);
CREATE TABLE IF NOT EXISTS community_notification_state (
 source_type TEXT PRIMARY KEY,baseline_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT OR IGNORE INTO community_notifications
 (id,event_key,category,kind,title,message,destination,related_id,related_label)
VALUES ('community-welcome-v1','system:community-welcome','system','system',
 'Welcome to PhoneYa2 Community',
 'Discover new businesses, useful updates, special offers and the latest PhoneYa2 stories — all in one place.',
 '/community/','','PhoneYa2 Community');
