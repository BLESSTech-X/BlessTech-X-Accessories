# PhoneYa2 unified communication setup

The communication flow uses Brevo for outbound email and transactional SMS. Formspree remains in place for incoming order/newsletter form alerts. No Resend configuration is required by the updated communication functions.

## Cloudflare Pages environment variables

Add these under the PhoneYa2 Pages project settings for Production (and Preview only if you want preview sends):

- \`BREVO_API_KEY\` — secret; create an API key in Brevo.
- \`BREVO_FROM_EMAIL\` — verified sender email address in Brevo.
- \`BREVO_FROM_NAME\` — optional sender name; defaults to \`PhoneYa2 Accessories\`.
- \`BREVO_SMS_SENDER\` — approved alphanumeric sender ID (maximum 11 letters/numbers); defaults to \`PhoneYa2\`.
- Keep \`ORDER_NOTIFY_EMAIL\` for the store owner's order alert.
- Keep existing Supabase and D1 bindings/secrets.

Verify the sender/domain in Brevo before sending. Buy SMS credits and register/approve the sender ID for Zambia in Brevo before expecting SMS delivery.

## Database updates

1. In Supabase SQL Editor, run the latest complete \`supabase/communication-centre.sql\` from this repository. It extends campaigns with the partner audience and service-message classification.
2. In the Cloudflare D1 database attached to PhoneYa2 Pages, run:
   - \`d1/migrations/0010_communication_activity.sql\`
   - \`d1/migrations/0011_partner_package_benefits.sql\`

These are additive updates. Do not drop existing order, partner, campaign or activity tables.

## Audience rules

- Newsletter marketing campaigns: only contacts whose newsletter status is \`subscribed\` (confirmed opt-in). Unsubscribed, pending and bounced contacts are excluded.
- Partner updates: all active/approved registered partners, including free partners, are targeted from the D1 partner records. These are operational Partner Studio/account updates, not a way to bypass marketing consent.
- Customer notifications: customers receive transactional order confirmation and order-status updates after they place an order. Newsletter signup is not required.
- SMS is used for transactional order updates and partner service notices. Phone numbers are normalized to Zambia's +260 country code; unsupported/invalid numbers are skipped and logged.

## Admin workflow

- Open \`/admin/campaigns.html\` from the Command Centre.
- Select either confirmed newsletter subscribers or registered partners.
- Save as draft, review the audience, then explicitly send. Batches process up to 20 recipients and can be resumed.
- Open \`/admin/communications.html\` to inspect email activity and the SMS/partner notification log.

## Safe test

1. Configure the Brevo sender and API key, then send a test newsletter confirmation to an email address you control.
2. Place a test order using an email and Zambian mobile number you control. Verify the customer email/SMS confirmation.
3. Change that test order's status in the admin order dashboard and verify the status email/SMS.
4. Create a partner update for one test partner first. Verify email and SMS, then inspect the Communication Centre logs.
5. Only use newsletter marketing sends with contacts who explicitly confirmed their subscription.

A Brevo API acceptance is not proof of inbox delivery. Use Brevo delivery events and its logs to confirm final delivery.
