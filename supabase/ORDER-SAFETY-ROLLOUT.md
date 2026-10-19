# PhoneYa2 Order Safety Rollout

## Current state

This is a reviewed draft change, not a production deployment. No live Supabase schema or order records have been changed by this branch.

The idempotency work prevents a retry of the same checkout request from creating a second order. It does **not** yet reserve or decrement product stock.

## Safe rollout order

1. Review pull request #31 and confirm the GitHub integrity workflow and hosting preview both pass. Do not deploy the new order API before the database migration.
2. Take a current Supabase database backup or confirm the project's available point-in-time recovery before modifying the schema.
3. Open `supabase/order-idempotency-migration.sql` from this branch and review it against the live `public.orders` and `public.order_items` definitions.
4. Run the migration in Supabase SQL Editor. It adds nullable idempotency metadata for new orders, creates a partial unique index, and replaces the service-role-only transaction RPC. Existing order rows are preserved.
5. Verify the migration before deploying application code:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
  AND column_name IN ('idempotency_key', 'request_fingerprint', 'customer_note')
ORDER BY column_name;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'orders'
  AND indexname = 'orders_idempotency_key_unique';

SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'create_phoneya2_order';
```

6. Only after the schema and RPC are verified, deploy the matching application code.
7. Run the tests below using a controlled test product and test customer details. Clean up test orders according to the store's existing retention process.

## Required acceptance tests

- A new valid order creates exactly one order and its item rows.
- Repeating the same request with the same idempotency key and fingerprint returns the same order number and does not repeat email, Formspree, Telegram, or account-invitation side effects.
- Reusing a key with different customer/order details is rejected with HTTP 409.
- Two simultaneous requests with the same key create only one order.
- A retry can recover the original order even if the product has since been edited or unpublished in the catalogue.
- A different key for a genuinely new order creates a new order.
- Existing checkout, order administration, customer confirmation, and analytics flows continue to work.
- Product slugs containing valid Unicode/emoji are not rejected by cart or checkout.
- Confirm that an RPC/database failure never displays a false success receipt.

## Rollback considerations

The migration preserves the existing six-argument RPC function for a controlled application rollback. An older application version does not get the new idempotency protection, so rollback should be temporary and followed by a forward fix. Do not drop the new columns or unique index during a normal application rollback.

## Inventory is a separate, unresolved control

Published stock currently comes from product Markdown managed through Decap CMS. A static catalogue read is not an atomic inventory reservation. The database migration above does not solve overselling when two different customers order the last unit concurrently.

### Next inventory gate: read-only reconciliation first

Before creating or applying an inventory migration, run `supabase/inventory-preflight.sql` against the intended Supabase project. It is **SELECT-only** and does not change the database. It reports the live schema, order-status population, product quantities attached to active/unfulfilled orders, and historical quantities by status.

Reconcile those results with the current Decap CMS `stock` values and the actual fulfilment process. Do not blindly subtract all historical order quantities: some orders may already have been fulfilled or manually deducted from catalogue stock. Do not seed a database inventory table from a stale product catalogue without resolving this first.

### Inventory design requirements

- A database transaction must atomically validate availability and reserve all items in an order, or reserve none of them.
- Each order needs auditable reservation rows and a clear reservation state so a retry cannot reserve twice.
- Status transitions must be atomic and idempotent. Cancellation must release only that order's outstanding reservation; a repeated cancellation must not add stock twice. Delivered/fulfilled orders must consume the reservation exactly once.
- The product pages, cart, checkout, and admin dashboards must display database-backed availability rather than stale Markdown stock once the database becomes authoritative.
- Decap CMS must provide a deliberate physical-count adjustment workflow. A publish hook must not blindly overwrite live availability with an old `stock` value. The adjustment needs an authenticated server-side path, audit history, conflict handling, and a defined rule for counts below already-reserved quantities.
- Historical orders, returns, damaged stock, partial fulfilments, and status reversals must be reconciled before seeding inventory.
- If the inventory service is unavailable, checkout must fail safely rather than assume the catalogue quantity is current.

That migration should not be drafted as a deployable stock solution until the preflight output and inventory semantics are reviewed. Until the atomic reservation and database-backed reads are implemented and tested, treat catalogue stock as a pre-check only, not a concurrency guarantee.
