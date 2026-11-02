-- Partner account sessions and authentication throttling.
-- Session bearer tokens are random, HttpOnly cookies; only SHA-256 hashes are stored.
CREATE TABLE IF NOT EXISTS partner_sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (account_id) REFERENCES advertiser_accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_partner_sessions_account
  ON partner_sessions(account_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_partner_sessions_expiry
  ON partner_sessions(expires_at);
CREATE TABLE IF NOT EXISTS partner_auth_attempts (
  ip_hash TEXT NOT NULL,
  attempted_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_partner_auth_attempts_ip_time
  ON partner_auth_attempts(ip_hash, attempted_at);

CREATE TABLE IF NOT EXISTS partner_enquiry_attempts (
  ip_hash TEXT NOT NULL,
  attempted_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_partner_enquiry_attempts_ip_time
  ON partner_enquiry_attempts(ip_hash, attempted_at);
