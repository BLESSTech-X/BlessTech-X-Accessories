-- Persistent owner-facing notifications for the PhoneYa2 Command Centre.
CREATE TABLE IF NOT EXISTS admin_notifications (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK(category IN ('orders','inventory','communications','newsletter','products','blog','website','operations')),
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
  destination TEXT NOT NULL DEFAULT '/admin/command-center.html',
  related_id TEXT NOT NULL DEFAULT '',
  related_label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0,1)),
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created ON admin_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread ON admin_notifications(is_read,category,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_category ON admin_notifications(category,created_at DESC);

-- Current stock snapshots prevent repeated low-stock alerts on every refresh.
CREATE TABLE IF NOT EXISTS admin_inventory_snapshots (
  product_slug TEXT PRIMARY KEY,
  product_title TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
