-- Agent-delivery progress is separate from the customer's order status until admin confirmation.
ALTER TABLE orders ADD COLUMN fulfilment_status TEXT NOT NULL DEFAULT 'central';
CREATE INDEX IF NOT EXISTS idx_orders_fulfilment_status ON orders(fulfilment_status,status,created_at DESC);
