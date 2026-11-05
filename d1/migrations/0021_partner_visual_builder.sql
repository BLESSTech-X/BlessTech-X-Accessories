CREATE TABLE IF NOT EXISTS partner_site_builder (
  advertiser_id TEXT PRIMARY KEY,
  project_json TEXT NOT NULL DEFAULT '{}',
  draft_html TEXT NOT NULL DEFAULT '',
  draft_css TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
);
