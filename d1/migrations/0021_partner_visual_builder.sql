CREATE TABLE IF NOT EXISTS partner_site_builder (
  advertiser_id TEXT PRIMARY KEY,
  project_json TEXT NOT NULL DEFAULT '{}',
  draft_html TEXT NOT NULL DEFAULT '',
  draft_css TEXT NOT NULL DEFAULT '',
  published_html TEXT NOT NULL DEFAULT '',
  published_css TEXT NOT NULL DEFAULT '',
  builder_published INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
);
