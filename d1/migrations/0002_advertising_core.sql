-- PhoneYa2 advertising core for Cloudflare D1.
-- This migration creates the clean replacement schema only.
-- It does not import, delete, or modify legacy Supabase records.
-- Keep the existing public ad/profile routes on their current data source
-- until the approved ads and advertiser ownership links have been imported
-- and the D1-backed routes have been verified.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ad_tiers (
  tier TEXT PRIMARY KEY,
  rank INTEGER NOT NULL UNIQUE,
  monthly_price_minor INTEGER NOT NULL DEFAULT 0 CHECK (monthly_price_minor >= 0),
  rotation_weight INTEGER NOT NULL CHECK (rotation_weight >= 1),
  ad_limit INTEGER NOT NULL CHECK (ad_limit >= 1),
  duration_days INTEGER NOT NULL DEFAULT 30 CHECK (duration_days >= 1)
);

INSERT OR IGNORE INTO ad_tiers
  (tier, rank, monthly_price_minor, rotation_weight, ad_limit, duration_days)
VALUES
  ('free', 0, 0, 1, 3, 30),
  ('starter', 1, 1000, 3, 5, 30),
  ('standard', 2, 2000, 6, 10, 30),
  ('business', 3, 5000, 12, 20, 30),
  ('premium', 4, 10000, 25, 40, 30);

-- New advertiser identities. Existing advertiser records are linked by
-- verified email during account claim; legacy passwords are never copied.
CREATE TABLE IF NOT EXISTS advertiser_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  email_verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','locked','disabled')),
  session_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS advertisers (
  id TEXT PRIMARY KEY,
  legacy_auth_user_id TEXT,
  account_id TEXT,
  business_name TEXT NOT NULL,
  owner_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL COLLATE NOCASE,
  logo_url TEXT NOT NULL DEFAULT '',
  tier TEXT NOT NULL DEFAULT 'free'
    REFERENCES ad_tiers(tier),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended','pending','approved')),
  verified_email INTEGER NOT NULL DEFAULT 0 CHECK (verified_email IN (0,1)),
  verified_phone INTEGER NOT NULL DEFAULT 0 CHECK (verified_phone IN (0,1)),
  tier_started_at TEXT,
  tier_expires_at TEXT,
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (account_id) REFERENCES advertiser_accounts(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_advertisers_account
  ON advertisers(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_advertisers_email
  ON advertisers(email COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_advertisers_tier_expiry
  ON advertisers(tier, tier_expires_at);

CREATE TABLE IF NOT EXISTS advertiser_profiles (
  id TEXT PRIMARY KEY,
  advertiser_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  tagline TEXT NOT NULL DEFAULT '',
  about TEXT NOT NULL DEFAULT '',
  primary_color TEXT NOT NULL DEFAULT '#ff6000',
  accent_color TEXT NOT NULL DEFAULT '#ff9f43',
  cover_image_url TEXT NOT NULL DEFAULT '',
  social_links_json TEXT NOT NULL DEFAULT '{}',
  contact_phone TEXT NOT NULL DEFAULT '',
  contact_whatsapp TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0,1)),
  view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ads (
  id TEXT PRIMARY KEY,
  advertiser_id TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  media_url TEXT NOT NULL DEFAULT '',
  media_type TEXT NOT NULL DEFAULT 'image'
    CHECK (media_type IN ('image','video')),
  video_provider TEXT NOT NULL DEFAULT '',
  destination_type TEXT NOT NULL DEFAULT 'website',
  destination_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','paused','banned')),
  placement TEXT NOT NULL DEFAULT 'carousel',
  weight INTEGER NOT NULL DEFAULT 1 CHECK (weight >= 1),
  start_date TEXT,
  end_date TEXT,
  rejection_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ads_public_rotation
  ON ads(status, placement, start_date, end_date, weight);
CREATE INDEX IF NOT EXISTS idx_ads_advertiser_created
  ON ads(advertiser_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_slug
  ON ads(slug);

-- New analytics begin at cutover. Historical analytics are intentionally
-- not imported as requested; old running campaigns remain intact.
CREATE TABLE IF NOT EXISTS ad_impressions (
  id TEXT PRIMARY KEY,
  ad_id TEXT NOT NULL,
  visitor_hash TEXT NOT NULL DEFAULT '',
  placement TEXT NOT NULL DEFAULT 'carousel',
  source TEXT NOT NULL DEFAULT 'direct',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad_created
  ON ad_impressions(ad_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ad_clicks (
  id TEXT PRIMARY KEY,
  ad_id TEXT NOT NULL,
  visitor_hash TEXT NOT NULL DEFAULT '',
  placement TEXT NOT NULL DEFAULT 'carousel',
  source TEXT NOT NULL DEFAULT 'direct',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_ad_created
  ON ad_clicks(ad_id, created_at DESC);

CREATE TABLE IF NOT EXISTS advertiser_profile_views (
  id TEXT PRIMARY KEY,
  advertiser_id TEXT NOT NULL,
  visitor_hash TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'direct',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_profile_views_advertiser_created
  ON advertiser_profile_views(advertiser_id, created_at DESC);

-- One-time verified-email claim records. Tokens are stored hashed, never raw.
CREATE TABLE IF NOT EXISTS advertiser_claims (
  id TEXT PRIMARY KEY,
  advertiser_id TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  claimed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_advertiser_claims_email
  ON advertiser_claims(email COLLATE NOCASE, expires_at);
