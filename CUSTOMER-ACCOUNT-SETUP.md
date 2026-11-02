# PhoneYa2 customer accounts — D1 order history and secure recovery

PhoneYa2 customer order history is stored in Cloudflare D1. Customer accounts do not depend on Supabase Auth. Guest checkout remains available.

## How access works

- Orders are saved in the D1 \`orders\` and \`order_items\` tables.
- The browser can view only orders associated with its signed device-order token.
- To restore all orders associated with an email address, the customer requests a one-time recovery link.
- The recovery link is sent through Brevo, expires after 15 minutes, and establishes a secure remembered-device cookie after successful verification.
- No customer password or Supabase account is required.

## Required Cloudflare configuration

- D1 binding named \`DB\`, pointing to the PhoneYa2 production database.
- \`BREVO_API_KEY\` as a secret.
- \`BREVO_FROM_EMAIL\` as a verified sender.
- \`BREVO_FROM_NAME\` optional.
- Existing customer recovery signing secret(s) used by \`functions/api/customer.js\`. Keep them private and do not expose them in browser code.

## Customer routes

- \`/account.html\`: order history, remembered-device access and secure email recovery.
- \`/api/customer\`: reads orders from D1 and verifies signed recovery/device tokens.
- \`/checkout.html\`: guest checkout remains available.

## Behaviour

- Orders are saved before any notification attempt. Email failure must not cancel or hide an order.
- A successful recovery link is the only way to establish a remembered device for the customer's full email-based order history.
- Without email verification, the page can show only orders associated with the current browser's signed device token.
- Customer account recovery is separate from newsletter marketing consent.

## Safe test

Place a test order with an email address you control. Request order-history recovery, open the email within 15 minutes, and confirm the correct D1 orders appear. Then reload the account page to confirm the remembered-device cookie works.
