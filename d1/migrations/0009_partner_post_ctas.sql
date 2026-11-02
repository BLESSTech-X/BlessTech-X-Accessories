-- Add optional action-button controls to partner website posts.
ALTER TABLE partner_posts ADD COLUMN cta_label TEXT NOT NULL DEFAULT '';
ALTER TABLE partner_posts ADD COLUMN cta_url TEXT NOT NULL DEFAULT '';
