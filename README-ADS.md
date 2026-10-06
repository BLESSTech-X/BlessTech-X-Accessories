## Paid Tier System

Advertisers can upgrade from Free to one of four paid tiers for a full
business presence on PhoneYa2. **Only admins can grant or revoke tiers**
(RLS-enforced, cannot be bypassed from the browser).

### The tiers

| Tier | Price/mo | Ads max | Rotation weight | Duration |
|---|---|---|---|---|
| **Free** | K0 | 3 | 1× | forever |
| **Starter** | K10 | 5 | 3× | 30 days |
| **Standard** | K20 | 10 | 6× | 30 days |
| **Business** | K50 | 20 | 12× | 30 days |
| **Premium** | K100 | 40 | 25× | 30 days |

### What each tier unlocks

- **Free** — 3 ads, basic rotation, auto-created business profile
- **Starter** — logo on profile, contact buttons
- **Standard** — full profile editing: cover image, custom brand colors,
  social links (FB/IG/TikTok/YouTube/Website), popup eligibility
- **Business** — custom profile URL (`/b/your-name`), verified badge,
  featured on other advertisers' share pages, priority support
- **Premium** — always featured in interstitials, direct line to support,
  white-glove onboarding

### How to upgrade a business (admin workflow)

1. Business contacts you (WhatsApp / call / email) via the upgrade modal
   on their dashboard.
2. They pay.
3. Open `/ads-admin/`, go to the **Advertisers** tab, click **Plan** on
   their row.
4. Pick the tier, set duration (default 30 days), toggle Verified if
   Business+ tier.
5. Click **Save Plan**.

The system automatically:
- Sets `tier_expires_at` (30 days out by default)
- Updates every one of that advertiser's ads to the new rotation weight
- Logs the change in the moderation log
- Sets the verified flag on their profile if applicable

### How expiry works

- When `tier_expires_at` passes, the advertiser is treated as **Free**
  everywhere in the UI (their dashboard shows an expired banner, their
  profile loses standard+ branding in the preview).
- **Their ads keep running at their old weight until you manually change
  it.** This is intentional — a lapse in payment shouldn't cause a
  sudden drop in visibility.
- The admin panel's **Expiring** tab lists everyone whose plan expires
  in the next 14 days, or has already expired. Message them via the
  built-in WhatsApp shortcut.

### How to revoke a tier

1. `/ads-admin/` → **Advertisers** tab → **Plan** on their row.
2. Click **Revoke to Free** (bottom-left of the modal).
3. Confirm.

All their ads' weight is reset to 1, expiry is cleared, verified is off.

### Payment contact details

The upgrade modal on the advertiser dashboard shows three buttons:
- **WhatsApp** → `+260 979 603 741`
- **Call** → `+260 979 603 741`
- **Email** → `singbless89@gmail.com`

Each is pre-filled with a message naming the business and the selected
tier. To change these, edit the `openPaymentModal()` function in
`advertiser/index.html`.

### Business profiles (the mini-websites)

Every advertiser gets a public profile at `/b/<slug>`:

- **Free tier**: auto-generated slug from business name, basic page
  with business name, contact buttons, and a list of their ads.
- **Starter+**: can add a tagline and about text, and upload a logo.
- **Standard+**: cover image, brand colors applied throughout the page,
  social links row.
- **Business+**: custom slug (they pick their URL), verified badge.

Profiles record views in `advertiser_profile_views` and every view
increments the `advertiser_profiles.view_count`. This is the number
shown on the advertiser's dashboard as "Profile Views."

### Ad routing

Clicking an ad card **anywhere** on the site (homepage interstitial,
shop page interstitial, popup) routes the visitor to the **business
profile** (`/b/<slug>`), not the ad page. The CTA button inside the
card still goes to the external destination (WhatsApp etc.).

The ad's own page at `/ad/<slug>` still exists — it's what advertisers
paste into WhatsApp when they share a specific ad. It now also links
to the business profile prominently.
