-- Explicit fulfilment responsibility for agent-held stock and centrally fulfilled orders.
ALTER TABLE orders ADD COLUMN fulfilment_source TEXT NOT NULL DEFAULT 'phoneya2';
ALTER TABLE orders ADD COLUMN fulfilment_agent_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_orders_fulfilment_agent ON orders(fulfilment_agent_id,status,created_at DESC);
