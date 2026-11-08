# PhoneYa2 Partner Subscription Lifecycle

This Worker runs hourly. It shares the production `phoneya2-core` D1 database with PhoneYa2 Pages.

## Deploy

From the repository root:

```bash
npx wrangler deploy --config workers/partner-lifecycle/wrangler.jsonc
```

Configure the Worker secret:

```bash
npx wrangler secret put BREVO_API_KEY --config workers/partner-lifecycle/wrangler.jsonc
```

The Pages project's existing `BREVO_API_KEY` secret is not automatically shared with this separate Worker. Add the same Brevo API key as a Worker secret. The sender email is already set in the Worker config.

Optional: set `PARTNER_LIFECYCLE_SECRET` as a Worker secret if you want to trigger a manual sweep using an authenticated POST request. The scheduled hourly trigger does not require it.

## D1 migration

Apply `d1/migrations/0017_partner_subscription_lifecycle.sql` to the production D1 database before deploying the updated Pages code or this Worker. It adds term and payment-reference fields, a subscription event ledger and deduplicated reminder delivery tracking. It does not delete existing partner data.

## Lifecycle

- Admin confirms a payment, chooses package and paid months, and the system stores the calculated start/end dates.
- Reminder notifications and transactional emails are scheduled at 7, 3 and 1 day(s) before expiry.
- At expiry, paid subscription status becomes `expired`, the partner tier returns to free and paid ad weighting is reset. Partner accounts, websites and content remain intact.
- Failed reminder emails are retried on the next hourly run. Partner in-app notifications are deduplicated.
- The Partner Studio also performs a lightweight expiry sweep on access, as a fallback if the hourly Worker is temporarily unavailable.
