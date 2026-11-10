-- Per-post analytics for the PhoneYa2 Partner Network.
-- Views are unique per visitor per post per UTC day; action events are counted as they happen.
CREATE TABLE IF NOT EXISTS partner_post_events (
  id TEXT PRIMARY KEY,
  advertiser_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('view','cta_click','share_click','message_click')),
  visitor_hash TEXT NOT NULL DEFAULT '',
  event_day TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'direct',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES partner_posts(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_post_daily_unique_view
  ON partner_post_events(advertiser_id,post_id,visitor_hash,event_day)
  WHERE event_type='view';
CREATE INDEX IF NOT EXISTS idx_partner_post_events_owner_post
  ON partner_post_events(advertiser_id,post_id,event_type,created_at DESC);
