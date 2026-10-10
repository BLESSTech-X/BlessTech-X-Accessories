# Communication Centre — Phase 3: delivery tracking and product announcements

This phase is staged on `feature/phoneya2-smart-communications`. It does not change `main` and does not make automatic marketing active by default.

## Added in this phase

- `functions/api/resend-webhook.js` verifies Resend/Svix webhook signatures and updates matching activity rows for delivered, bounced, complained, and failed events.
- `functions/api/product-announcement.js` accepts only requests signed with a server-side shared secret, checks the `new_product_announcement` automation switch, deduplicates products, and sends to confirmed subscribers in batches of 20.
- `.github/workflows/phoneya2-product-announcements.yml` runs only when new product Markdown files are added to `main`; edits to existing product files do not trigger an announcement.
- `product_announcement_jobs` tracks product announcement progress and prevents duplicate jobs per product slug.

## Updated SQL is required

Run the **latest full** `supabase/communication-centre.sql` again in the same Supabase project. It now includes the campaign table, subscriber confirmation-token fields, and `product_announcement_jobs`. Confirm the tables/columns exist before testing.

## Additional secrets to configure (never share their values)

- Cloudflare Pages: `RESEND_WEBHOOK_SECRET` — signing secret copied from the Resend webhook configuration.
- Cloudflare Pages: `PRODUCT_ANNOUNCEMENT_SECRET` — a strong random secret used only by the product-announcement endpoint.
- GitHub repository Actions secret: `PHONEYA2_PRODUCT_ANNOUNCEMENT_SECRET` — the exact same value as Cloudflare's `PRODUCT_ANNOUNCEMENT_SECRET`.

Configure the Resend webhook destination as `https://phoneya2.pages.dev/api/resend-webhook`, subscribed to the relevant email events (delivered, bounced, complained, failed). Test the signature before relying on status updates.

## Keep product marketing disabled until you choose to enable it

The SQL seed keeps `new_product_announcement` disabled by default. After testing opt-in/unsubscribe and confirming the audience is appropriate, an administrator may enable it explicitly in Supabase SQL Editor:

```sql
UPDATE public.communication_automations
SET enabled = true, updated_at = now()
WHERE automation_key = 'new_product_announcement';
```

Do not run that update until you want newly added products on `main` to trigger real marketing emails. Only subscribers who confirmed their opt-in are eligible. The GitHub workflow requires the repository secret and the Cloudflare shared secret; if those are missing, the workflow will fail rather than bypass the guard.

## Validation before release

1. Run the latest migration and verify `public.email_campaigns`, `public.product_announcement_jobs`, and subscriber confirmation-token columns exist.
2. Verify newsletter double opt-in and unsubscribe using an email address you control.
3. Send a campaign to a test-only opted-in list, then verify it is recorded in `email_activity`.
4. Configure and test Resend webhook signatures; verify the matching activity status changes to delivered/bounced/failed.
5. Keep product announcements disabled while testing. After enabling only with explicit approval, add a new product file to a test branch first and verify the workflow logic before enabling production `main` automation.
6. Check GitHub Actions logs and Cloudflare function logs; never log or expose secrets.

## Boundaries

- Delivery status depends on the Resend webhook being configured and the matching provider message ID being present in `email_activity`.
- Automatic announcements trigger on **newly added** product Markdown files pushed to `main`, not updates to existing product files.
- Each workflow run processes up to 1,000 recipients per product (50 batches of 20); if more remain, the workflow fails with a resume instruction. This limit should be revisited before a large audience is reached.
- Scheduled follow-ups, back-in-stock notifications, advanced campaign analytics, and a dedicated admin toggle UI are not included yet.

## Release gate

Keep the pull request in draft until the staged integration tests pass. Do not merge to `main` or deploy without explicit approval.