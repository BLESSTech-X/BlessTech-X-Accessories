-- Admin moderation controls for partner-owned website content.
-- Normal partner publishing remains instant; only explicit admin moderation suspends content.
ALTER TABLE partner_catalog_items ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (moderation_status IN ('approved','suspended'));
ALTER TABLE partner_posts ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (moderation_status IN ('approved','suspended'));
ALTER TABLE partner_pages ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (moderation_status IN ('approved','suspended'));
CREATE INDEX IF NOT EXISTS idx_partner_catalog_moderation ON partner_catalog_items(moderation_status, published);
CREATE INDEX IF NOT EXISTS idx_partner_posts_moderation ON partner_posts(moderation_status, status);
CREATE INDEX IF NOT EXISTS idx_partner_pages_moderation ON partner_pages(moderation_status, published);
