-- PhoneYa2 Partners platform foundation.
-- Extends the existing advertiser identity/profile model without deleting or
-- rewriting any advertiser, ad, impression, click, or profile-view records.
-- All partners can build full catalogues and publish content; packages add
-- growth, promotion, analytics and brand capabilities rather than arbitrary
-- content-count ceilings.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS partner_packages (
  package_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  monthly_price_minor INTEGER NOT NULL CHECK (monthly_price_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ZMW',
  sort_order INTEGER NOT NULL UNIQUE,
  advertising_weight INTEGER NOT NULL DEFAULT 1 CHECK (advertising_weight >= 1),
  benefits_json TEXT NOT NULL DEFAULT '{}',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT OR IGNORE INTO partner_packages
  (package_key, display_name, monthly_price_minor, sort_order, advertising_weight, benefits_json)
VALUES
  ('free', 'Partner', 0, 0, 1, '{"website":"professional","catalogue":"full","publishing":"full","analytics":"essential","branding":"standard","promotion":"directory"}'),
  ('starter', 'Starter', 1000, 1, 3, '{"website":"professional","catalogue":"full","publishing":"full","analytics":"essential","branding":"expanded","promotion":"boosted"}'),
  ('standard', 'Growth', 2000, 2, 6, '{"website":"advanced","catalogue":"full","publishing":"full","analytics":"advanced","branding":"custom","promotion":"priority"}'),
  ('business', 'Business', 5000, 3, 12, '{"website":"advanced","catalogue":"full","publishing":"full","analytics":"advanced","branding":"custom","promotion":"premium","verification":"eligible"}'),
  ('premium', 'Premium', 10000, 4, 25, '{"website":"premium","catalogue":"full","publishing":"full","analytics":"premium","branding":"full","promotion":"maximum","verification":"priority","support":"priority"}');

CREATE TABLE IF NOT EXISTS partner_subscriptions (
  id TEXT PRIMARY KEY,
  advertiser_id TEXT NOT NULL,
  package_key TEXT NOT NULL REFERENCES partner_packages(package_key),
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment','active','past_due','cancelled','expired')),
  currency TEXT NOT NULL DEFAULT 'ZMW',
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','annual')),
  starts_at TEXT,
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK (cancel_at_period_end IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_partner_subscriptions_owner
  ON partner_subscriptions(advertiser_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_subscriptions_status
  ON partner_subscriptions(status, current_period_end);

CREATE TABLE IF NOT EXISTS partner_payment_submissions (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  advertiser_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ZMW',
  payment_method TEXT NOT NULL DEFAULT 'mobile_money',
  provider_reference TEXT NOT NULL,
  payer_phone TEXT NOT NULL DEFAULT '',
  proof_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','confirmed','rejected')),
  admin_note TEXT NOT NULL DEFAULT '',
  reviewed_at TEXT,
  reviewed_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (subscription_id) REFERENCES partner_subscriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_partner_payments_review
  ON partner_payment_submissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_payments_owner
  ON partner_payment_submissions(advertiser_id, created_at DESC);

CREATE TABLE IF NOT EXISTS partner_site_settings (
  id TEXT PRIMARY KEY,
  advertiser_id TEXT NOT NULL UNIQUE,
  site_title TEXT NOT NULL DEFAULT '',
  site_description TEXT NOT NULL DEFAULT '',
  hero_title TEXT NOT NULL DEFAULT '',
  hero_subtitle TEXT NOT NULL DEFAULT '',
  hero_image_url TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  primary_color TEXT NOT NULL DEFAULT '#ff6000',
  accent_color TEXT NOT NULL DEFAULT '#163b70',
  font_pair TEXT NOT NULL DEFAULT 'modern',
  template_key TEXT NOT NULL DEFAULT 'signature',
  show_catalogue INTEGER NOT NULL DEFAULT 1 CHECK (show_catalogue IN (0,1)),
  show_services INTEGER NOT NULL DEFAULT 1 CHECK (show_services IN (0,1)),
  show_posts INTEGER NOT NULL DEFAULT 1 CHECK (show_posts IN (0,1)),
  published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0,1)),
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  social_links_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS partner_pages (
  id TEXT PRIMARY KEY,
  advertiser_id TEXT NOT NULL,
  page_key TEXT NOT NULL,
  title TEXT NOT NULL,
  content_json TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (advertiser_id, page_key),
  FOREIGN KEY (advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_partner_pages_owner
  ON partner_pages(advertiser_id, sort_order);

CREATE TABLE IF NOT EXISTS partner_catalog_items (
  id TEXT PRIMARY KEY,
  advertiser_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('product','service')),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  price_minor INTEGER,
  currency TEXT NOT NULL DEFAULT 'ZMW',
  price_label TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  gallery_json TEXT NOT NULL DEFAULT '[]',
  category TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  availability TEXT NOT NULL DEFAULT 'available',
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0,1)),
  published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (advertiser_id, slug),
  FOREIGN KEY (advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_partner_catalog_owner
  ON partner_catalog_items(advertiser_id, item_type, published, sort_order);

CREATE TABLE IF NOT EXISTS partner_posts (
  id TEXT PRIMARY KEY,
  advertiser_id TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT NOT NULL DEFAULT '',
  post_type TEXT NOT NULL DEFAULT 'update',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (advertiser_id, slug),
  FOREIGN KEY (advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_partner_posts_public
  ON partner_posts(advertiser_id, status, published_at DESC);

CREATE TABLE IF NOT EXISTS partner_enquiries (
  id TEXT PRIMARY KEY,
  advertiser_id TEXT NOT NULL,
  catalog_item_id TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'website',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','won','closed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE,
  FOREIGN KEY (catalog_item_id) REFERENCES partner_catalog_items(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_partner_enquiries_owner
  ON partner_enquiries(advertiser_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS partner_site_events (
  id TEXT PRIMARY KEY,
  advertiser_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view','catalogue_view','item_view','contact_click','whatsapp_click','enquiry_submit')),
  resource_id TEXT NOT NULL DEFAULT '',
  visitor_hash TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'direct',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_partner_site_events_owner
  ON partner_site_events(advertiser_id, event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS partner_media_assets (
  id TEXT PRIMARY KEY,
  advertiser_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  file_name TEXT NOT NULL DEFAULT '',
  file_size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_partner_media_owner
  ON partner_media_assets(advertiser_id, created_at DESC);
