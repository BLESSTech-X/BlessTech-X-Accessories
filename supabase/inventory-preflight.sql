-- PhoneYa2 inventory migration preflight — READ ONLY.
-- Run this BEFORE designing/applying any inventory migration.
-- It does not create, update, reserve, or delete any data.
-- Review the output alongside current Decap CMS product stock and the real fulfilment process.

-- 1) Confirm the relevant order tables and columns actually present in this database.
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('orders', 'order_items')
ORDER BY table_name, ordinal_position;

-- 2) Understand the current order status population before defining which statuses reserve stock.
SELECT lower(trim(coalesce(status, ''))) AS status,
       count(*) AS order_count,
       coalesce(sum(total_amount), 0) AS order_value
FROM public.orders
GROUP BY lower(trim(coalesce(status, '')))
ORDER BY order_count DESC;

-- 3) Inspect quantities attached to active/unfulfilled orders.
-- Treat this as a review report, not a definitive reservation ledger: existing orders may
-- have been manually fulfilled, partially fulfilled, refunded, or adjusted outside the app.
SELECT oi.product_slug,
       oi.product_name,
       sum(oi.quantity)::bigint AS units_in_active_orders,
       count(DISTINCT o.id) AS affected_orders
FROM public.order_items AS oi
JOIN public.orders AS o ON o.id = oi.order_id
WHERE lower(trim(coalesce(o.status, ''))) IN ('pending', 'confirmed', 'processing', 'shipped')
GROUP BY oi.product_slug, oi.product_name
ORDER BY units_in_active_orders DESC, oi.product_slug;

-- 4) Review all historical quantities by product and order status for reconciliation.
SELECT oi.product_slug,
       lower(trim(coalesce(o.status, ''))) AS status,
       sum(oi.quantity)::bigint AS units,
       count(DISTINCT o.id) AS order_count
FROM public.order_items AS oi
JOIN public.orders AS o ON o.id = oi.order_id
GROUP BY oi.product_slug, lower(trim(coalesce(o.status, '')))
ORDER BY oi.product_slug, status;

-- 5) Check for duplicate idempotency keys if the idempotency migration has already been applied.
-- This query deliberately avoids referencing optional columns when they do not exist.
SELECT CASE
  WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'idempotency_key'
  ) THEN 'Idempotency column exists; run the guarded query below.'
  ELSE 'Idempotency column not present; skip duplicate-key check.'
END AS idempotency_preflight;

-- Run this only if the preceding result confirms the column exists:
-- SELECT idempotency_key, count(*) FROM public.orders
-- WHERE idempotency_key IS NOT NULL
-- GROUP BY idempotency_key HAVING count(*) > 1;

-- 6) Record the actual inventory semantics with the store operator before migration:
-- - Is the CMS stock value physical units on hand, sellable units, or a manually maintained estimate?
-- - Are pending orders intended to reserve stock, or only confirmed orders?
-- - At what point is stock considered consumed: confirmation, dispatch, or delivery?
-- - How are cancelled, returned, damaged, and partially fulfilled items handled?
-- - Who is allowed to adjust physical counts, and how is each adjustment audited?
-- Do not seed authoritative inventory until these questions and the output above are reconciled.
