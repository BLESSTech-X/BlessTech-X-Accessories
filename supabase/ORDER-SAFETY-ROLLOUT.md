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

Before claiming inventory is protected, PhoneYa2 needs an authoritative database inventory/reservation model and a deliberate synchronization workflow with Decap CMS. That design must specify which source wins on conflicts, when stock is decremented/released, how cancelled orders restore stock, and how existing stock values are migrated. Until that work is implemented and tested, treat catalogue stock as a pre-check only, not a concurrency guarantee.
