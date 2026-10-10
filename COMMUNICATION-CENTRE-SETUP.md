# PhoneYa2 Smart Communication Centre — Phase 1

This phase adds customer order-confirmation emails, records automatic order-alert and customer-confirmation attempts, and provides a protected admin activity dashboard. It is staged on the `feature/phoneya2-smart-communications` branch; it is not deployed to the production site by this change alone.

## What this phase does

- Keeps the existing order-save process as the source of truth. An email failure does not undo a saved order.
- Continues to email the store owner about a new order.
- Sends the customer a transactional confirmation email after the order is successfully saved.
- Records each owner order alert, customer confirmation, and manual notification test in `public.email_activity`.
- Shows exact database totals plus the latest 250 activity records in `/admin/communications.html`.
- Keeps customer email addresses and activity logs behind the existing allowlisted administrator authentication.
- Does not subscribe customers to marketing automatically. A purchase and a marketing subscription remain separate.

## Required setup before testing

1. In the PhoneYa2 Supabase project, open **SQL Editor** and run the complete file `supabase/communication-centre.sql` once.
2. Confirm Cloudflare Pages has the existing production secrets/variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (secret)
   - `SUPABASE_ANON_KEY` (or the existing publishable-key variable)
   - `ADMIN_EMAIL`
   - `ORDER_NOTIFY_EMAIL`
   - `RESEND_API_KEY` (secret)
   - `RESEND_FROM` (verified sender)
3. Deploy the reviewed branch only after you approve it. Do not paste secret values into GitHub, chat, or browser-side code.
4. Open `/admin/communications.html` and sign in with the authorized admin account.

## Safe test plan

1. Open the new communication dashboard and confirm it loads the email activity table.
2. Use a controlled test order with an email address you can access.
3. Confirm the order still appears in the existing order dashboard.
4. Confirm the store-owner alert reaches `ORDER_NOTIFY_EMAIL`.
5. Confirm the customer receives a message titled `We received your PhoneYa2 order <order number>`.
6. Confirm two activity records appear: `new_order_alert` and `order_confirmation`, with the correct recipient, subject, trigger, order number and provider status.
7. Temporarily test with a controlled invalid recipient only if appropriate, then confirm a failed attempt is visible. Do not deliberately send to unrelated people's addresses.
8. Verify an unauthenticated request to `/api/communications?admin=1` returns HTTP 401.

## Status meanings and limitations

- `sent` means Resend accepted the message request. It does **not** prove the email reached the inbox.
- `delivered` and `bounced` will be shown when delivery webhooks are implemented in a later phase; Phase 1 does not yet ingest those provider events.
- The table shows the latest 250 records for usability. Summary counters are computed in Supabase across the full email activity table.
- The dashboard is currently a read-only activity centre. Subscriber management, manual campaigns, scheduling, product-publish detection, delivery webhooks, retries, and campaign performance are later phases.
- Customer order confirmations are transactional. The new `customer_subscribers` table is not automatically populated from orders, and customers must separately opt in before promotional email is sent.
- Supabase invitation/account-activation messages are separate from order confirmations and are not currently included in this email activity log.

## Rollback notes

Do not run a destructive rollback on the database. If a problem appears during testing, disable or revert the code branch and leave the activity tables in place so audit records are preserved. The migration is additive and is safe to leave installed if the code is rolled back.
