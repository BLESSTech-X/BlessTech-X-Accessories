# PhoneYa2 Agent Network

The active agent system is part of the PhoneYa2 Cloudflare Pages application.

- Agent portal: `/agents/network.html`
- Agent API: `/api/agent-network`
- Command Centre administration: Command Centre → Agents
- Admin API: `/api/agent-network-admin`
- Database: Cloudflare D1 binding `DB`

## Account lifecycle

1. A person applies with their name, email, phone number and password.
2. Their account remains pending until a PhoneYa2 administrator approves it.
3. Approved agents sign in with their individual credentials.
4. Agents complete their public profile, share referral links and record assisted sales.
5. Customers complete purchases through PhoneYa2 checkout.
6. Orders are attributed to active agent referral codes for the configured attribution period.
7. Commission is reconciled after delivery, product costs are configured, and an administrator approves it.
8. Agents can request any amount up to their available balance. Payouts are processed weekly.

## Commission rules

The Agent Network uses configurable percentage commission bands. Administrators manage the price thresholds and percentages in Command Centre → Agents → Commission rules. The applicable percentage is calculated from the product selling price and saved with the assisted-sale estimate. Online referral commissions are reconciled after delivery; offline agent sales are credited only after an administrator verifies the sale.

## Central stock and agent custody

PhoneYa2 owns the stock. Agents collect approved quantities from central stock without buying the stock upfront. Command Centre → Agents → Agent inventory is the control point:

1. Issue stock to an active agent. Central available stock decreases and the agent's PhoneYa2 custody increases.
2. Record a return. The agent's custody decreases and central available stock increases.
3. Record an offline sale only against unreserved PhoneYa2 stock allocated to that agent. The sale remains pending until an administrator verifies it.
4. Approving the sale deducts the sold quantity from the agent's custody and credits the saved percentage commission.
5. Agent-attributed online checkout reserves either the agent's custody or central stock. Orders fulfilled from agent custody appear in the agent fulfilment queue; central-stock orders remain with PhoneYa2.
6. Cancelling an undelivered reserved order restores the relevant stock automatically.

Every issue, return, verified sale and order reservation is recorded in the stock movement history. New product stock is initially seeded from the CMS product record; after a product is synced to Agent Network, live central stock is managed in Command Centre → Agents → Agent inventory. The public Shop shows central availability; an agent referral product link shows central availability plus stock held by that specific referred agent.

Do not issue more stock than the central available quantity. Reconcile physical stock before approving sale records or changing central stock counts.

## Deployment and database

Apply the pending D1 migrations in order from `d1/migrations` using the existing `phoneya2-core` database. Do not run duplicate or already-applied migrations blindly; inspect the D1 migration history first. Keep all code changes on `main`.

The Agent Network schema is delivered in these additive migrations:

- `0025_agent_network.sql` — individual agent accounts, profiles, sessions, product codes, sales, leads, commission ledger, inventory, recruitment and Partner Studio onboarding progress.
- `0026_agent_wallet_allocations.sql` — partial withdrawals, payout allocations and default progressive commission bands.
- `0027_agent_profile_media.sql` — uploaded agent profile images.
- `0028_agent_sale_estimates.sql` — product price/stock snapshots and commission estimates.
- `0029_agent_fulfilment.sql` — order fulfilment responsibility.
- `0030_agent_sale_customer_details.sql` — assisted-sale customer location and notes.
- `0031_agent_payout_provider.sql` — MTN, Airtel and Zamtel payout routing.
- `0032_agent_delivery_status.sql` — agent delivery milestones and admin confirmation.
- `0033_agent_commission_recovery.sql` — recovery offsets when an already-paid commission is later reversed.

Apply all migrations in order only after checking the live D1 migration history. The storefront order API includes a compatibility fallback for older schemas, but Agent Network features require the complete migration set.

The old Supabase-based agent pages and shared PY2-360 access-code portal are retired. The new system does not use Supabase.
