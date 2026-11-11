-- PhoneYa2 Agent Network foundation. Additive only; existing orders and partner data remain intact.
PRAGMA foreign_keys = ON;
ALTER TABLE orders ADD COLUMN agent_code TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN agent_referral_code TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN agent_attribution_source TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN agent_attributed_at TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_agent_code_created ON orders(agent_code, created_at DESC);
CREATE TABLE IF NOT EXISTS agent_accounts (
 id TEXT PRIMARY KEY, agent_id TEXT NOT NULL UNIQUE, referral_code TEXT NOT NULL UNIQUE,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE, phone TEXT NOT NULL DEFAULT '',
 password_salt TEXT NOT NULL, password_hash TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','rejected','suspended')),
 approved_at TEXT, approved_by TEXT NOT NULL DEFAULT '', rejection_note TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_accounts_status ON agent_accounts(status,created_at DESC);
CREATE TABLE IF NOT EXISTS agent_profiles (
 agent_id TEXT PRIMARY KEY, display_name TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '',
 profile_image_url TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '',
 public_profile INTEGER NOT NULL DEFAULT 1 CHECK(public_profile IN (0,1)),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 FOREIGN KEY(agent_id) REFERENCES agent_accounts(agent_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS agent_sessions (
 id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
 expires_at TEXT NOT NULL, revoked_at TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 FOREIGN KEY(agent_id) REFERENCES agent_accounts(agent_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_expiry ON agent_sessions(expires_at);
CREATE TABLE IF NOT EXISTS agent_auth_attempts (ip_hash TEXT NOT NULL, attempted_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_agent_auth_attempts_ip_time ON agent_auth_attempts(ip_hash,attempted_at);
CREATE TABLE IF NOT EXISTS agent_product_codes (
 product_slug TEXT PRIMARY KEY, product_code TEXT NOT NULL UNIQUE,
 product_name TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS agent_product_rules (
 product_slug TEXT PRIMARY KEY, cost_minor INTEGER, commission_profit_cap_pct REAL NOT NULL DEFAULT 30,
 commission_enabled INTEGER NOT NULL DEFAULT 1 CHECK(commission_enabled IN (0,1)),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 CHECK(cost_minor IS NULL OR cost_minor >= 0),
 CHECK(commission_profit_cap_pct BETWEEN 0 AND 100)
);
CREATE TABLE IF NOT EXISTS agent_leads (
 id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, customer_name TEXT NOT NULL,
 customer_phone TEXT NOT NULL, customer_email TEXT NOT NULL DEFAULT '',
 product_slug TEXT NOT NULL DEFAULT '', product_code TEXT NOT NULL DEFAULT '',
 quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity BETWEEN 1 AND 99),
 location TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','interested','checkout_sent','converted','lost')),
 follow_up_at TEXT, consent_recorded INTEGER NOT NULL DEFAULT 0 CHECK(consent_recorded IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 FOREIGN KEY(agent_id) REFERENCES agent_accounts(agent_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_agent_leads_owner ON agent_leads(agent_id,status,created_at DESC);
CREATE TABLE IF NOT EXISTS agent_sales (
 id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, lead_id TEXT,
 product_slug TEXT NOT NULL, product_code TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99),
 customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, customer_email TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','verified','order_linked','rejected','cancelled')),
 linked_order_id TEXT, admin_note TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 FOREIGN KEY(agent_id) REFERENCES agent_accounts(agent_id) ON DELETE CASCADE,
 FOREIGN KEY(lead_id) REFERENCES agent_leads(id) ON DELETE SET NULL,
 FOREIGN KEY(linked_order_id) REFERENCES orders(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_sales_owner ON agent_sales(agent_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_sales_order ON agent_sales(linked_order_id);
CREATE TABLE IF NOT EXISTS agent_commission_ledger (
 id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, order_id TEXT NOT NULL UNIQUE,
 order_number TEXT NOT NULL, sale_amount_minor INTEGER NOT NULL DEFAULT 0,
 product_cost_minor INTEGER, gross_profit_minor INTEGER,
 calculated_commission_minor INTEGER NOT NULL DEFAULT 0,
 commission_minor INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'needs_cost' CHECK(status IN ('needs_cost','pending_review','available','paid','reversed')),
 rule_snapshot_json TEXT NOT NULL DEFAULT '{}', admin_note TEXT NOT NULL DEFAULT '',
 eligible_at TEXT, approved_at TEXT, paid_at TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 FOREIGN KEY(agent_id) REFERENCES agent_accounts(agent_id) ON DELETE CASCADE,
 FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_agent_commission_owner ON agent_commission_ledger(agent_id,status,created_at DESC);
CREATE TABLE IF NOT EXISTS agent_payout_requests (
 id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
 payment_method TEXT NOT NULL DEFAULT 'mobile_money', payment_phone TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','paid','rejected')),
 payment_reference TEXT NOT NULL DEFAULT '', admin_note TEXT NOT NULL DEFAULT '',
 requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 reviewed_at TEXT, reviewed_by TEXT NOT NULL DEFAULT '', paid_at TEXT,
 FOREIGN KEY(agent_id) REFERENCES agent_accounts(agent_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_agent_payout_owner ON agent_payout_requests(agent_id,status,requested_at DESC);
CREATE TABLE IF NOT EXISTS agent_inventory (
 id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, product_slug TEXT NOT NULL,
 quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0), ownership TEXT NOT NULL DEFAULT 'phoneya2'
 CHECK(ownership IN ('phoneya2','agent')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(agent_id,product_slug,ownership),
 FOREIGN KEY(agent_id) REFERENCES agent_accounts(agent_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS agent_inventory_movements (
 id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, product_slug TEXT NOT NULL,
 quantity_delta INTEGER NOT NULL, movement_type TEXT NOT NULL,
 reference TEXT NOT NULL DEFAULT '', actor TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 FOREIGN KEY(agent_id) REFERENCES agent_accounts(agent_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS agent_referrals (
 id TEXT PRIMARY KEY, referrer_agent_id TEXT NOT NULL, recruited_agent_id TEXT NOT NULL UNIQUE,
 milestone_sales INTEGER NOT NULL DEFAULT 5, reward_minor INTEGER NOT NULL DEFAULT 10000,
 status TEXT NOT NULL DEFAULT 'tracking' CHECK(status IN ('tracking','earned','paid','void')),
 earned_at TEXT, paid_at TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 FOREIGN KEY(referrer_agent_id) REFERENCES agent_accounts(agent_id) ON DELETE CASCADE,
 FOREIGN KEY(recruited_agent_id) REFERENCES agent_accounts(agent_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS agent_notifications (
 id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, event_key TEXT NOT NULL UNIQUE,
 title TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', destination TEXT NOT NULL DEFAULT '',
 read_at TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 FOREIGN KEY(agent_id) REFERENCES agent_accounts(agent_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_agent_notifications_owner ON agent_notifications(agent_id,read_at,created_at DESC);
CREATE TABLE IF NOT EXISTS partner_onboarding_progress (
 advertiser_id TEXT PRIMARY KEY, completed_steps_json TEXT NOT NULL DEFAULT '[]',
 dismissed INTEGER NOT NULL DEFAULT 0 CHECK(dismissed IN (0,1)),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 FOREIGN KEY(advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
);
