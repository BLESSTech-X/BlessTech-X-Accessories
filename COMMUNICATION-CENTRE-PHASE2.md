# Communication Centre — Phase 2 Addendum

This addendum documents the opt-in newsletter and manual campaign tools added on the feature branch. The branch remains unmerged and is not production-live.

## Added in Phase 2

- `newsletter.html`: public signup form requiring explicit consent.
- `functions/api/subscribe.js`: double-opt-in confirmation and unsubscribe flow.
- `admin/campaigns.html`: authenticated campaign composer, subscriber counts, and manual send/resume controls.
- `functions/api/campaigns.js`: administrator-only campaign API. Only `subscribed` records are eligible; each request processes at most 20 recipients. Accepted recipients are skipped on resume and failed sends can be retried.
- `email_campaigns` table and subscriber confirmation token columns.

## Important: rerun the updated SQL migration

The Phase 1 SQL was run before these additions. Run the **updated full** `supabase/communication-centre.sql` file again in the same PhoneYa2 Supabase project. The Phase 2 statements use additive `IF NOT EXISTS`/conflict-safe operations. Do not drop tables or run destructive rollback SQL.

After running it, verify:

```sql
SELECT to_regclass('public.email_campaigns') AS campaigns_table;
SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='customer_subscribers' AND column_name IN ('confirmation_token','confirmation_sent_at');
```

Expected: `email_campaigns` and both subscriber columns exist.

## Preview test order

1. Open `/admin/communications.html` and `/admin/campaigns.html` in the preview; sign in with the authorized admin account.
2. Open `/newsletter.html`. Submit an email address you control and explicitly tick consent.
3. Confirm the confirmation email arrives. Click the confirmation link; verify the row becomes `subscribed` in `public.customer_subscribers`.
4. Create a harmless test campaign. Before sending, ensure the only subscribed address is one you control. Send it and verify receipt plus an `email_activity` row with `event_type=marketing_campaign`.
5. Click the unsubscribe link and confirm the record becomes `unsubscribed`. Ensure future campaign sends exclude it.
6. Submit a controlled order using an email address you control; verify both customer confirmation and owner notification and their activity rows.
7. Check the browser console and Cloudflare function logs for errors. An unauthenticated request to `/api/communications?admin=1` must return HTTP 401.

## Known limitations (not yet finished)

- Resend acceptance is recorded as `sent`; inbox delivery is not verified without delivery webhooks.
- No automated retries, delivery/bounce webhooks, scheduled campaigns, campaign analytics, back-in-stock alerts, or post-purchase follow-ups yet.
- New-product announcements are not triggered automatically by CMS publishes. Campaigns can currently be composed and sent manually.
- `newsletter.html` exists as a landing page; public storefront navigation/footer still needs a link if you want it discoverable from every page.
- The signup endpoint should be protected with rate limiting/abuse controls before broad promotion.

## Release safety

Keep this on the feature branch until all preview tests pass. Do not merge into `main` or deploy to production without explicit approval. Never expose `SUPABASE_SERVICE_ROLE_KEY` or `RESEND_API_KEY` in browser code or chat.