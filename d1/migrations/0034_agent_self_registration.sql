-- Agent self-registration: activate existing pending accounts without manual review.
UPDATE agent_accounts
SET status='active',
    approved_at=COALESCE(approved_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    approved_by=CASE WHEN approved_by='' THEN 'self-registration-migration' ELSE approved_by END,
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE status='pending';
