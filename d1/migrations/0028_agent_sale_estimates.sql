-- Product-code snapshots and agent-side commission estimates.
ALTER TABLE agent_product_codes ADD COLUMN price_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_product_codes ADD COLUMN stock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_sales ADD COLUMN estimated_sale_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_sales ADD COLUMN estimated_commission_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_sales ADD COLUMN commission_note TEXT NOT NULL DEFAULT '';
