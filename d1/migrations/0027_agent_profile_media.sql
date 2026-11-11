-- Agent profile media stored in the existing D1-backed image delivery pattern.
CREATE TABLE IF NOT EXISTS agent_media_assets (
 id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE,
 public_url TEXT NOT NULL, media_type TEXT NOT NULL DEFAULT 'image',
 file_name TEXT NOT NULL DEFAULT '', file_size INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 FOREIGN KEY(agent_id) REFERENCES agent_accounts(agent_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_agent_media_owner ON agent_media_assets(agent_id,created_at DESC);
