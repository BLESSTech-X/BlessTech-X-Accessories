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

The default progressive bands are configured in D1 migration `0026_agent_wallet_allocations.sql`. The percentages apply to successive portions of the sale value, not the entire sale. Commission is capped by a configurable share of gross profit. Product unit costs must be entered by an administrator before commission can be approved.

## Inventory

Command Centre → Agents → Agent inventory records PhoneYa2 stock held by agents and agent-owned stock declarations. Stock allocations must be reconciled with the central product catalogue and fulfilment process.

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

Apply all migrations in order only after checking the live D1 migration history. The storefront order API includes a compatibility fallback for older schemas, but Agent Network features require the complete migration set.

The old Supabase-based agent pages and shared PY2-360 access-code portal are retired. The new system does not use Supabase.
