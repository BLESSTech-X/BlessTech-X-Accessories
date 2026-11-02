-- PhoneYa2 blog comments on Cloudflare D1.
-- Existing Supabase comments are not deleted or modified by this migration.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS blog_comments (
  id TEXT PRIMARY KEY,
  post_slug TEXT NOT NULL,
  commenter TEXT NOT NULL,
  message TEXT NOT NULL,
  submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected'))
);
CREATE INDEX IF NOT EXISTS idx_blog_comments_post_status_date
  ON blog_comments(post_slug, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_comments_status_date
  ON blog_comments(status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS blog_comment_rate_limits (
  ip_hash TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0
);
