-- Partner-owned public social posts/links displayed on partner mini-sites.
CREATE TABLE IF NOT EXISTS partner_social_embeds (id TEXT PRIMARY KEY,advertiser_id TEXT NOT NULL,platform TEXT NOT NULL,url TEXT NOT NULL,title TEXT NOT NULL DEFAULT '',caption TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE);
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_social_embeds_unique_url ON partner_social_embeds(advertiser_id,url);
CREATE INDEX IF NOT EXISTS idx_partner_social_embeds_owner_created ON partner_social_embeds(advertiser_id,created_at DESC);
