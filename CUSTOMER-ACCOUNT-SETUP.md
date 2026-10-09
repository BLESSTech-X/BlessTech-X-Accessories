# PhoneYa2 customer accounts — activation and testing

This feature keeps guest checkout available. After an order is saved, the order API attempts to invite the customer to activate a Supabase Auth account. Customers set their own password from the invitation email and can then view orders associated with their verified email address.

## Required Supabase settings

In Supabase Dashboard for the PhoneYa2 project:

1. Open **Authentication → URL Configuration**.
2. Set the Site URL to `https://phoneya2.pages.dev` if that is the canonical production hostname.
3. Add `https://phoneya2.pages.dev/account.html` to the allowed Redirect URLs.
4. Open **Authentication → SMTP Settings** and configure a working SMTP provider so Supabase can deliver invitation and password-reset emails. Confirm the invitation email template is enabled and its action link redirects to the account page.

The order API uses the existing server-side `SUPABASE_SERVICE_ROLE_KEY` (or legacy `SUPABASE_SECRET_KEY`) to send invitations. This key must remain a Cloudflare Pages server secret and must never be exposed in browser code.

## Customer routes

- `/account.html`: customer sign-in, password setup/reset, order history and reorder links.
- `/api/customer`: returns orders only for the email address of the authenticated, email-verified Supabase user.
- `/checkout.html`: guest checkout remains available; cart lines can be restored from the customer's reorder link.

## Behaviour

- Orders are saved before the invitation is attempted. Email/invitation failure must not cancel or hide an order.
- Repeat customers who already have an Auth account can sign in. The invite endpoint may return an “already exists” response; this is expected and does not affect the order.
- Order history is matched to the authenticated user's verified email. An email address typed into a guest checkout alone never grants access to history.
- Reordering builds a new cart from the previous order's product slugs and quantities. Checkout and the server re-check current prices and stock; the old order is not modified.
- Notifications include customer name, email, phone/WhatsApp, item summary, total and order number. Avoid putting payment credentials or other sensitive data into ntfy messages.

## Test checklist

1. Configure and verify Supabase redirect and SMTP settings.
2. Place one low-cost internal test order using an email address you control.
3. Confirm the order appears in `/admin/orders.html` and ntfy includes customer contact information.
4. Confirm the customer receives an invitation, opens it, sets a password, and lands on `/account.html`.
5. Confirm only that account can view the matching order and that **Reorder items** restores products into checkout.
6. Test a repeat order using the same email, then sign in normally and confirm both orders appear.
7. Test a different account and verify it cannot see the first customer's orders.
8. Check Cloudflare deployment logs if the invite fails. Orders should still save, but account activation email delivery requires Supabase SMTP and the allowed redirect URL.

Do not run the tests by placing multiple real orders. Use one controlled test order and cancel/close it in the admin screen after verification.
