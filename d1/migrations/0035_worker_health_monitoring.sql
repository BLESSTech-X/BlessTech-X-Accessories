CREATE TABLE IF NOT EXISTS worker_health (
  worker_key TEXT PRIMARY KEY,
  worker_name TEXT NOT NULL,
  schedule TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'never_run' CHECK (status IN ('never_run','running','success','failed')),
  last_started_at TEXT,
  last_success_at TEXT,
  last_failure_at TEXT,
  last_duration_ms INTEGER,
  last_error TEXT,
  total_runs INTEGER NOT NULL DEFAULT 0,
  failed_runs INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_worker_health_status ON worker_health(status, updated_at);
