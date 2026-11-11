-- Partial and full commission withdrawal allocations. Supports any amount up to available balance.
CREATE TABLE IF NOT EXISTS agent_payout_allocations (
 id TEXT PRIMARY KEY, payout_id TEXT NOT NULL, commission_id TEXT NOT NULL,
 amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(payout_id,commission_id),
 FOREIGN KEY(payout_id) REFERENCES agent_payout_requests(id) ON DELETE RESTRICT,
 FOREIGN KEY(commission_id) REFERENCES agent_commission_ledger(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_agent_payout_allocations_commission ON agent_payout_allocations(commission_id);
CREATE TABLE IF NOT EXISTS agent_commission_settings (
 setting_key TEXT PRIMARY KEY, setting_value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT OR IGNORE INTO agent_commission_settings(setting_key,setting_value) VALUES
 ('bands_json','[{"up_to_minor":20000,"rate":10},{"up_to_minor":50000,"rate":8},{"up_to_minor":100000,"rate":6},{"up_to_minor":300000,"rate":4},{"up_to_minor":500000,"rate":3},{"up_to_minor":null,"rate":2}]'),
 ('profit_cap_pct','30'),
 ('referral_attribution_days','30'),
 ('recruitment_milestone_sales','5'),
 ('recruitment_reward_minor','10000');
