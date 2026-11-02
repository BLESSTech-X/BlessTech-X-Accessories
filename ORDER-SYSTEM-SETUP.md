# PhoneYa2 order system — Cloudflare D1 setup

PhoneYa2 order storage and order management use Cloudflare Pages Functions with the D1 database binding named \`DB\`. This setup does not require Supabase.

## 1. D1 database

Ensure the production PhoneYa2 Pages project has a D1 binding named \`DB\` pointing to the production PhoneYa2 database.

For a fresh D1 database, apply the existing migrations in order, beginning with:

- \`d1/migrations/0001_orders.sql\` — creates \`orders\`, \`order_items\` and the D1 \`email_activity\` log.

Apply any later order-related migrations in numeric order as applicable to the current database. Do not run the old Supabase SQL files for this D1 implementation.

## 2. Cloudflare Pages configuration

Cloudflare Dashboard → Workers & Pages → PhoneYa2 Pages project → Settings → Variables and Secrets. Configure the existing administrator/authentication settings and the following production values where used:

| Name | Type | Purpose |
| --- | --- | --- |
| \`ADMIN_EMAIL\` | Variable | Authorized administrator email |
| \`ORDER_NOTIFY_EMAIL\` | Variable | Store owner order alerts |
| \`BREVO_API_KEY\` | Secret | Outbound transactional email and SMS API |
| \`BREVO_FROM_EMAIL\` | Variable | Verified Brevo sender |
| \`BREVO_FROM_NAME\` | Variable | Optional sender display name |
| \`BREVO_SMS_SENDER\` | Variable | Approved sender ID for Zambia |
| \`NTFY_TOPIC\` | Secret | Optional private order-alert topic, if using ntfy |

Keep the current Cloudflare admin/session secrets already configured for the Command Centre. Do not add Supabase variables for the D1 order system. Never expose provider keys in browser code, GitHub or public configuration.

## 3. Order notifications

Brevo sends customer order confirmation and order-status email. If SMS credentials and sender approval are configured, transactional SMS is also sent. The D1 \`email_activity\` and \`communication_activity\` tables record notification attempts.

An API acceptance from Brevo is not proof of final inbox or handset delivery. Confirm delivery in Brevo's logs.

## 4. Test before switching storefront buttons

After confirming the D1 binding, migrations and provider configuration:

1. Open \`/checkout.html\`, add at least two different products, and submit a clearly labelled internal test order.
2. Confirm one row appears in D1 \`orders\`, with matching rows in \`order_items\`, and that the order total is correct.
3. Confirm the owner order alert reaches \`ORDER_NOTIFY_EMAIL\` and the customer receives the order confirmation by email and, if configured, SMS.
4. Open \`/admin/orders.html\`, sign in with the authorized administrator account, and confirm the order is visible and status updates work.
5. Verify an unauthenticated request to \`/api/orders?admin=1\` is rejected.
6. Only after all checks pass, point the storefront order buttons to \`/checkout.html\`.

## Routes

- Customer checkout: \`/checkout.html\`
- Order API: \`/api/orders\`
- Private admin screen: \`/admin/orders.html\`
- Admin API: \`/api/orders?admin=1\`

The checkout does not collect payment. New orders start in \`pending\`; the store confirms the order and arranges payment/delivery with the customer.
