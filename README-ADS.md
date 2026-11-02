# PhoneYa2 Partner Network — D1 System Reference

PhoneYa2 now uses Cloudflare D1 as the source of truth for partner accounts, business websites, catalogues, posts, enquiries, promotions and campaign analytics. The previous Supabase advertiser login/client is retired from the storefront and partner workflows.

## Public entry points

- Partner registration: `/partners/`
- Partner Studio: `/partners-dashboard/`
- Partner business websites: `/b/<slug>`
- Public promotion pages: `/ad/<slug>`
- Partner network administration: `/partners-admin/`

## Architecture

- Hosting: Cloudflare Pages.
- Database: Cloudflare D1 binding `DB`, database `phoneya2-core`.
- Partner API: `/api/partner`.
- Public campaign feed and engagement: `/api/partner-ads`.
- Public business enquiries: `/api/partner-enquiry`.
- Admin data and moderation: `/api/ads-admin`.
- Admin authentication: `/api/auth`, using the shared `__Host-py2_admin` secure cookie.
- Partner authentication: `__Host-py2_partner`, HttpOnly, Secure and SameSite=Lax. Passwords are PBKDF2-SHA256 hashes; only SHA-256 session-token hashes are stored in D1.

## Partner capabilities

Partners register once and manage their business from Partner Studio:
- Business website identity, description, hero, logo, colours, SEO and social links.
- Products and services, pricing, imagery, availability and visibility.
- Business updates, offers, news and guides.
- Customer enquiries and their follow-up status.
- Promotional campaigns with image/video creative, destination, placement and date window.
- Campaign pause, edit, resubmission and performance totals (impressions and clicks).

New campaigns are created as `pending`. A partner cannot approve their own campaign. Editing an approved campaign returns it to `pending` for review. Pausing an approved campaign removes it from the public feed. Resubmission sends it back to moderation.

## Campaign plans and rotation

The `ad_tiers` table defines campaign limits and rotation weights:

| Package | Monthly price | Active campaign limit | Rotation weight |
|---|---:|---:|---:|
| Partner | K0 | 3 | 1× |
| Starter | K10 | 5 | 3× |
| Growth | K20 | 10 | 6× |
| Business | K50 | 20 | 12× |
| Premium | K100 | 40 | 25× |

The Partner API enforces active campaign limits for new campaign submissions and assigns rotation weight from the partner's D1 tier. Administrators can change partner package and access from Partner Network Control. Changing a package recalculates the weight of the partner's pending and approved campaigns.

Package payment collection and automated subscription renewal are not implemented here. Package changes are administrator-managed.

## Campaign lifecycle and moderation

`pending → approved → public`

Other available states are `rejected`, `paused` and `banned`. Only approved campaigns with an eligible partner status and a valid start/end date are returned by the public campaign feed. Customer reports are stored in `ad_reports` and reviewed in Partner Network Control. Moderation actions are recorded in `ad_moderation_log`.

## Public delivery and analytics

Storefront pages use `/api/partner-ads` to load approved D1 campaigns. The feed includes business identity and profile slug for cards and placements. Public engagement is recorded in D1:
- `ad_impressions`
- `ad_clicks`
- `ad_reports`

Business profile visits are recorded in `advertiser_profile_views` and `partner_site_events`. Partner Studio displays aggregate campaign impressions and clicks for the signed-in partner.

## Required D1 migrations

The partner and campaign schema depends on the existing migrations:
- `0002_advertising_core.sql`
- `0003_advertising_moderation.sql`
- `0006_phoneya2_partners.sql`
- `0007_partner_sessions.sql`

Apply any unapplied migrations with:

```bash
npx wrangler d1 migrations apply phoneya2-core --remote
```

## Operational checks before public launch

1. Confirm Cloudflare Pages deploy completed successfully.
2. Confirm D1 migrations 0002, 0003, 0006 and 0007 are applied.
3. Register a test partner, sign out, and sign back in.
4. Save and publish a business website; verify `/b/<slug>`.
5. Add a product/service and publish a business update.
6. Submit a campaign; approve it in `/partners-admin/`.
7. Verify the campaign appears on the homepage/shop and its `/ad/<slug>` page.
8. Verify impression and click totals update in Partner Studio.
9. Submit a public enquiry and verify it appears in Partner Studio.
10. Test suspension, rejection, pause, resubmission and customer report handling.

Do not describe the platform as fully live until the deployed site passes these end-to-end checks.
