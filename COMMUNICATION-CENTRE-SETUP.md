# PhoneYa2 Smart Communication Centre — current production implementation

The communication system is committed to \`main\`. It uses Brevo for outbound email and transactional SMS. Formspree remains in place for incoming order/newsletter form alerts. Resend is not used by the current communication functions.

## Connected audiences

- **Newsletter marketing:** only subscribers with status \`subscribed\` after double opt-in. Pending, unsubscribed and bounced contacts are excluded.
- **Registered partners:** all active/approved partners, including free partners, can receive operational Partner Studio updates even if they never joined the newsletter. These are account/platform notices, not marketing-consent bypasses.
- **Ordering customers:** order confirmation and every order-status change are sent as transactional email and SMS when the relevant provider channel is configured. A purchase does not subscribe the customer to marketing.
- **Activity:** email events are visible in the Email activity log; SMS and partner notification attempts appear in the SMS and partner notification log.

## Required setup

1. Run the latest complete \`supabase/communication-centre.sql\` in Supabase SQL Editor.
2. Run D1 migrations \`0010_communication_activity.sql\` and \`0011_partner_package_benefits.sql\` against the PhoneYa2 D1 database.
3. Configure Cloudflare Pages Production variables/secrets:
   - \`BREVO_API_KEY\` (secret)
   - \`BREVO_FROM_EMAIL\` (verified sender)
   - \`BREVO_FROM_NAME\` (optional; defaults to PhoneYa2 Accessories)
   - \`BREVO_SMS_SENDER\` (approved Zambia sender ID; defaults to PhoneYa2)
   - Keep \`ORDER_NOTIFY_EMAIL\`, Supabase secrets and the D1 binding.
4. Purchase Brevo SMS credits and register/approve the sender ID for Zambia.
5. Redeploy Cloudflare Pages after the variables and secrets are configured.

## Admin workflow

- \`/admin/campaigns.html\`: select confirmed newsletter subscribers for marketing or all registered partners for operational partner updates. Review the content, save a draft, and explicitly send. Sends process in batches of 20.
- \`/admin/communications.html\`: inspect email attempts and the SMS/partner notification log.
- \`/admin/orders.html\`: update order status; the customer is notified by email and SMS when configured.

## Safe testing

Use only contact details you control for initial tests. First confirm newsletter double opt-in and unsubscribe. Then place a test order using your own email and Zambian mobile number. Change its status and check both delivery channels. Finally send one partner update to a test partner and inspect both activity logs.

Brevo acceptance is not proof of inbox/handset delivery. Confirm delivery using Brevo's logs and delivery events. Never put API keys or service-role keys in browser code, GitHub, or chat.
