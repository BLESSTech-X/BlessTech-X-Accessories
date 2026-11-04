-- Premium-only mini-site composition controls.
ALTER TABLE partner_site_settings ADD COLUMN hero_height TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE partner_site_settings ADD COLUMN menu_style TEXT NOT NULL DEFAULT 'standard';
