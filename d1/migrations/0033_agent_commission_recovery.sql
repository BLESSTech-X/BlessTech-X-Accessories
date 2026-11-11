-- Recover paid commissions from later-cancelled orders without deleting financial history.
CREATE TABLE IF NOT EXISTS agent_wallet_adjustments (
 id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, order_id TEXT NOT NULL,
 amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
 reason TEXT NOT NULL DEFAULT 'cancelled_order_after_payout',
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','recovered')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 recovered_at TEXT,
 UNIQUE(agent_id,order_id),
 FOREIGN KEY(agent_id) REFERENCES agent_accounts(agent_id) ON DELETE CASCADE,
 FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS agent_adjustment_recoveries (
 id TEXT PRIMARY KEY, adjustment_id TEXT NOT NULL, commission_id TEXT NOT NULL,
 amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(adjustment_id,commission_id),
 FOREIGN KEY(adjustment_id) REFERENCES agent_wallet_adjustments(id) ON DELETE RESTRICT,
 FOREIGN KEY(commission_id) REFERENCES agent_commission_ledger(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_agent_adjustments_owner ON agent_wallet_adjustments(agent_id,status,created_at);
