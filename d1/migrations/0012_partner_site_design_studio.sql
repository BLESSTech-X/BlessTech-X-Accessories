-- Partner mini-site design studio: expanded visual controls with package entitlements.
ALTER TABLE partner_site_settings ADD COLUMN page_background TEXT NOT NULL DEFAULT 'soft';
ALTER TABLE partner_site_settings ADD COLUMN header_style TEXT NOT NULL DEFAULT 'clean';
ALTER TABLE partner_site_settings ADD COLUMN post_layout TEXT NOT NULL DEFAULT 'cards';
ALTER TABLE partner_site_settings ADD COLUMN post_image_fit TEXT NOT NULL DEFAULT 'cover';
ALTER TABLE partner_site_settings ADD COLUMN post_card_style TEXT NOT NULL DEFAULT 'elevated';
ALTER TABLE partner_site_settings ADD COLUMN button_style TEXT NOT NULL DEFAULT 'rounded';
ALTER TABLE partner_site_settings ADD COLUMN content_width TEXT NOT NULL DEFAULT 'wide';
ALTER TABLE partner_site_settings ADD COLUMN announcement_text TEXT NOT NULL DEFAULT '';
ALTER TABLE partner_site_settings ADD COLUMN announcement_link TEXT NOT NULL DEFAULT '';
ALTER TABLE partner_site_settings ADD COLUMN show_announcement INTEGER NOT NULL DEFAULT 0 CHECK (show_announcement IN (0,1));
ALTER TABLE partner_site_settings ADD COLUMN show_social_links INTEGER NOT NULL DEFAULT 1 CHECK (show_social_links IN (0,1));
ALTER TABLE partner_site_settings ADD COLUMN show_contact_bar INTEGER NOT NULL DEFAULT 1 CHECK (show_contact_bar IN (0,1));

UPDATE partner_packages SET benefits_json=json_set(benefits_json,'$.design','basic') WHERE package_key='free';
UPDATE partner_packages SET benefits_json=json_set(benefits_json,'$.design','expanded') WHERE package_key='starter';
UPDATE partner_packages SET benefits_json=json_set(benefits_json,'$.design','advanced') WHERE package_key='standard';
UPDATE partner_packages SET benefits_json=json_set(benefits_json,'$.design','premium') WHERE package_key='business';
UPDATE partner_packages SET benefits_json=json_set(benefits_json,'$.design','full') WHERE package_key='premium';
