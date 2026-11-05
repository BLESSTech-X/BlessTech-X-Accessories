ALTER TABLE partner_site_builder ADD COLUMN published_html TEXT NOT NULL DEFAULT '';
ALTER TABLE partner_site_builder ADD COLUMN published_css TEXT NOT NULL DEFAULT '';
ALTER TABLE partner_site_builder ADD COLUMN builder_published INTEGER NOT NULL DEFAULT 0;
