-- Zambia mobile-money payout routing information.
ALTER TABLE agent_payout_requests ADD COLUMN payment_provider TEXT NOT NULL DEFAULT '';
