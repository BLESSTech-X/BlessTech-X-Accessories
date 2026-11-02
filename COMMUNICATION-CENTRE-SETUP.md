# PhoneYa2 Smart Communication Centre — Cloudflare D1

The current implementation stores communication data in Cloudflare D1. Supabase is not required or used by these communication APIs. Cloudflare Pages Functions connect D1 to Brevo (outbound email/SMS) and Formspree (inbound form alerts).

## Connected audiences

- Newsletter marketing: confirmed D1 subscribers only.
- Registered partners: active/approved D1 partner records, including free partners, receive operational Partner Studio updates.
- Ordering customers: transactional order confirmation and order-status notifications; buying does not subscribe anyone to marketing.
- Activity: email and phone-channel attempts are recorded in D1 and shown in the Communication Centre.

## Required setup

1. Ensure the Pages D1 binding is named \`DB\` and points to the production PhoneYa2 database.
2. Apply D1 migrations \`0010_communication_activity.sql\`, \`0011_partner_package_benefits.sql\`, and \`0012_unified_communications.sql\` in order if not already applied.
3. Configure Pages secrets/variables: \`BREVO_API_KEY\`, \`BREVO_FROM_EMAIL\`, optional \`BREVO_FROM_NAME\`, approved \`BREVO_SMS_SENDER\`, and \`PRODUCT_ANNOUNCEMENT_SECRET\`. Keep the existing admin/authentication and \`ORDER_NOTIFY_EMAIL\` settings.
4. Purchase Brevo SMS credits and obtain sender-ID approval for Zambia.
5. Redeploy Pages after configuration.

Do not configure Supabase secrets for this communication system.

## Admin workflow

- \`/admin/campaigns.html\`: create and send newsletter or partner campaigns in batches of 20.
- \`/admin/communications.html\`: inspect email/SMS attempts, subscriber totals and automation settings.
- \`/admin/orders.html\`: update order status and trigger transactional customer notifications.

## Important audience safeguards

Newsletter promotions require confirmed opt-in. Partner updates are operational service notices, not newsletter promotions. Order notifications are transactional. No order or partner registration silently opts someone into marketing.

## Testing

Use only contact details you control for initial tests. Verify newsletter confirmation and unsubscribe, then place a test order, change its status, and send a partner update. Check D1 activity logs and Brevo delivery logs. A provider-accepted response is not proof of final delivery.

Existing subscribers held only in an external/old database are not automatically copied into D1. Import them only from an authorized export, preserving their original consent and unsubscribe status.
