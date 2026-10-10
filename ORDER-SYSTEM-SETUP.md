# PhoneYa2 order system — production setup

This change adds the checkout page, server-side order API, database transaction function, and admin order screen. The existing product-page buttons intentionally remain on Google Forms until production configuration is complete, so customers are not sent to a checkout that cannot yet submit.

## 1. Install the database transaction function

For a fresh setup, in Supabase Dashboard → SQL Editor, run `supabase/order-system.sql`.

For the existing PhoneYa2 production database, run `supabase/order-note-migration.sql` in Supabase SQL Editor once before using the optional customer order-note field. This adds the note column and safely updates the transaction function. The `orders` and `order_items` tables must already exist.

The function inserts the order and every item in a single database transaction. It is executable only by `service_role`; never call it from browser code with a secret key.

## 2. Add Cloudflare Pages production secrets and variables

Cloudflare Dashboard → Workers & Pages → PhoneYa2 Pages project → Settings → Variables and Secrets. Add these for the **Production** environment, then redeploy.

| Name | Type | Value |
| --- | --- | --- |
| `SUPABASE_URL` | Variable | The project's Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | The server-only Supabase service-role/secret key |
| `SUPABASE_ANON_KEY` | Variable | The project's public publishable/anon key |
| `ADMIN_EMAIL` | Variable | The exact email address of the one authorized admin account |
| `ORDER_NOTIFY_EMAIL` | Variable | `singbless89@gmail.com` |
| `TELEGRAM_BOT_TOKEN` | Secret | Token for your private PhoneYa2 Telegram bot (instructions below) |
| `TELEGRAM_CHAT_ID` | Variable | Your Telegram chat ID for receiving order alerts |
| `RESEND_API_KEY` | Secret | API key from Resend |
| `RESEND_FROM` | Variable | Sender address on a domain verified in Resend, e.g. `PhoneYa2 Orders <orders@your-verified-domain>` |

**Never put `SUPABASE_SERVICE_ROLE_KEY` or `RESEND_API_KEY` in HTML, JavaScript shipped to the browser, GitHub, or a public config file.** Use Cloudflare's encrypted Secrets field for these two values.

## 3. Create the admin login

In Supabase Dashboard → Authentication → Users, create/invite the account whose email exactly matches `ADMIN_EMAIL`. The admin page uses Supabase email/password sign-in, then the server checks the verified user identity and allowlisted email on every admin API request. Do not use a shared weak password.

## 4. Phone app alerts with Telegram

PhoneYa2 can send order alerts to Telegram and email independently. If either route fails, the other can still deliver the alert. Telegram is optional until both values below are configured.

1. In Telegram, open the verified **@BotFather** account and send `/newbot`. Follow the prompts and copy the bot token.
2. Open the new bot's chat and press **Start**.
3. To get your chat ID, send a message to your new bot, then open `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` in a browser, replacing the placeholder with your token. Find `message` → `chat` → `id`. Keep the token private and do not share screenshots containing it.
4. In Cloudflare Pages → Settings → Variables and Secrets → **Production**, add `TELEGRAM_BOT_TOKEN` as a **Secret** and `TELEGRAM_CHAT_ID` as a **Variable**. Redeploy.
5. Open `/admin/orders.html` and press the notification test button. Confirm both a Telegram message and a test email arrive.

If `getUpdates` returns no messages, send another message to the bot and refresh the page. Never publish the bot token in GitHub or browser-side code.

## 5. Email configuration

Resend must have a verified sender domain and a valid API key. If email is not configured, the order endpoint can still save orders but returns `notification_sent: false`; do not switch the storefront to the new checkout until notification delivery is configured and tested.

## 6. Test before switching storefront buttons

After setting secrets and redeploying:
1. Open `/checkout.html`, add at least two different products, and submit a clearly labelled internal test order.
2. Confirm one row appears in `orders`, with the expected matching rows in `order_items`, and the order total equals the sum of item totals.
3. Confirm the order email reaches `singbless89@gmail.com`.
4. Open `/admin/orders.html`, sign in with the allowlisted account, and confirm the order is visible and status updates work.
5. Verify an unauthenticated request to `/api/orders?admin=1` is rejected.
6. Only after all checks pass, update the three existing storefront pages to send order buttons to `/checkout.html`.

## Routes

- Customer checkout: `/checkout.html`
- Order API: `/api/orders`
- Private admin screen: `/admin/orders.html`
- Admin API: `/api/orders?admin=1`

The checkout does not collect payment. New orders start in `pending`; the store must confirm the order and arrange delivery/payment with the customer.
