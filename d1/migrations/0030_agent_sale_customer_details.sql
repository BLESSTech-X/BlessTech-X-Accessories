-- Additional context for assisted sale records.
ALTER TABLE agent_sales ADD COLUMN customer_location TEXT NOT NULL DEFAULT '';
ALTER TABLE agent_sales ADD COLUMN notes TEXT NOT NULL DEFAULT '';
