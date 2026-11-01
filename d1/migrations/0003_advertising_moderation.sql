-- Fresh moderation records for the Cloudflare advertising system.
-- Historical moderation and reports are intentionally not imported.

CREATE TABLE IF NOT EXISTS ad_reports (
  id TEXT PRIMARY KEY,
  ad_id TEXT NOT NULL,
  reporter_hash TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  resolved INTEGER NOT NULL DEFAULT 0 CHECK (resolved IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  resolved_at TEXT,
  FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ad_reports_open
  ON ad_reports(resolved, created_at DESC);

CREATE TABLE IF NOT EXISTS ad_moderation_log (
  id TEXT PRIMARY KEY,
  ad_id TEXT,
  action TEXT NOT NULL,
  reason TEXT,
  performed_by TEXT NOT NULL DEFAULT 'admin',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ad_moderation_log_created
  ON ad_moderation_log(created_at DESC);

-- Compatibility shape consumed by the existing Ads Admin plan display.
CREATE VIEW IF NOT EXISTS tier_config AS
SELECT tier, rank, rotation_weight AS weight, ad_limit
FROM ad_tiers;
