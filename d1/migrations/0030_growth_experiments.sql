-- Persistent Growth Lab experiments. Additive D1 migration; preserves all existing records.
CREATE TABLE IF NOT EXISTS growth_experiments (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 category TEXT NOT NULL DEFAULT 'product_page',
 hypothesis TEXT NOT NULL DEFAULT '',
 change_description TEXT NOT NULL DEFAULT '',
 product_slug TEXT NOT NULL DEFAULT '',
 channel TEXT NOT NULL DEFAULT 'website',
 audience TEXT NOT NULL DEFAULT 'all_visitors',
 primary_metric TEXT NOT NULL DEFAULT 'completed_orders',
 baseline_value REAL,
 target_value REAL,
 result_value REAL,
 duration_days INTEGER NOT NULL DEFAULT 7,
 status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','running','review','won','lost','inconclusive','paused')),
 start_at TEXT,
 end_at TEXT,
 notes TEXT NOT NULL DEFAULT '',
 learning TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_growth_experiments_status ON growth_experiments(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_experiments_dates ON growth_experiments(start_at,end_at);
