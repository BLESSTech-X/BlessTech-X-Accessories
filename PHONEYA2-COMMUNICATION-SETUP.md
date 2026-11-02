# PhoneYa2 Communication Centre — Cloudflare D1 setup

PhoneYa2 communications use **Cloudflare D1** for all subscriber, campaign, automation, product-announcement and activity records. Cloudflare Pages Functions provide the APIs. Brevo sends outbound email/SMS. Formspree remains for incoming form alerts. Supabase is not part of this communication setup.

## 1. Apply D1 migrations

Open the Cloudflare dashboard, select the D1 database bound to the PhoneYa2 Pages project, and execute these migrations in order if they have not already been applied:

1. \`d1/migrations/0010_communication_activity.sql\`
2. \`d1/migrations/0011_partner_package_benefits.sql\`
3. \`d1/migrations/0012_unified_communications.sql\`

Migration 0012 creates the D1 newsletter subscriber list, campaign records, automation settings and product-announcement queue. It also extends the existing D1 email activity log. It does not delete existing order, partner or activity data.

## 2. Cloudflare Pages configuration

Confirm the Pages project has the D1 binding named \`DB\` pointing to the correct production database. Configure:

- \`BREVO_API_KEY\` — secret.
- \`BREVO_FROM_EMAIL\` — verified sender email.
- \`BREVO_FROM_NAME\` — optional; defaults to PhoneYa2 Accessories.
- \`BREVO_SMS_SENDER\` — approved Zambia sender ID, up to 11 alphanumeric characters.
- \`PRODUCT_ANNOUNCEMENT_SECRET\` — secret used by the product-publish integration.
- Keep \`ORDER_NOTIFY_EMAIL\` and existing admin/authentication secrets.

Do not add Supabase variables for this communication system. Never expose API keys in browser code or commit them to GitHub.

Buy Brevo SMS credits and obtain approval for the sender ID before expecting SMS delivery in Zambia.

## 3. Audience rules

- **Newsletter marketing:** only contacts with D1 subscriber status \`subscribed\`, after double opt-in. Pending, unsubscribed and bounced contacts are excluded.
- **Partners:** active/approved partner records in D1, including free partners, receive operational account updates. A partner does not need newsletter consent for relevant service notices.
- **Customers:** order confirmations and order-status messages are transactional. Placing an order does not subscribe a customer to marketing.
- **Product announcements:** only confirmed newsletter subscribers receive these promotional emails. The automation is disabled by default until deliberately enabled in D1.

## 4. Admin workflow

- \`/admin/campaigns.html\`: create drafts for confirmed newsletter subscribers or registered partners, then explicitly send in batches of up to 20.
- \`/admin/communications.html\`: inspect D1 email activity, SMS activity, subscriber totals and automation settings.
- \`/admin/orders.html\`: order-status changes trigger customer notifications through the configured Brevo channels.

## 5. Safe verification

1. Subscribe using an email address you control and confirm the email. Check that its D1 status becomes \`subscribed\`.
2. Unsubscribe using the email link and confirm it is excluded from future marketing sends.
3. Place a test order using your own email and Zambian mobile number; test a later status change.
4. Create a partner update and test with a partner account you control.
5. Check both activity logs in the Communication Centre.

Brevo accepting a request does not prove inbox or handset delivery. Confirm delivery in Brevo's logs.
