-- One-time email verification and password-reset tokens for Cloudflare advertiser accounts.
-- Raw tokens are never stored; only SHA-256 token hashes are persisted.

CREATE TABLE IF NOT EXISTS advertiser_auth_tokens (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify_email','reset_password')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (account_id) REFERENCES advertiser_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_advertiser_auth_tokens_account
  ON advertiser_auth_tokens(account_id, purpose, expires_at);

CREATE INDEX IF NOT EXISTS idx_advertiser_auth_tokens_email
  ON advertiser_auth_tokens(email COLLATE NOCASE, purpose, expires_at);
