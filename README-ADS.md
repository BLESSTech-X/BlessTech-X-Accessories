# PhoneYa2 Ads — System Reference

This document describes what is actually implemented in the PhoneYa2 Ads
system as of the current schema. It is kept in sync with the database.

For anything not listed here as "implemented", see the Roadmap section at
the bottom. Do not claim a Roadmap feature in the UI or in advertiser
communications until it is enforced server-side and this document is
updated to reflect that.

---

## 1. Plans

Five plans. Every number below is stored in `public.tier_config` and is
enforced by database triggers, not by the client.

| Plan     | Price / month | Active ads | Rotation weight |
|----------|---------------|------------|-----------------|
| Free     | K0            | 3          | 1×              |
| Starter  | K10           | 5          | 3×              |
| Standard | K20           | 10         | 6×              |
| Business | K50           | 20         | 12×             |
| Premium  | K100          | 40         | 25×             |

**Active ads** means ads with status `pending` or `approved`. Ads in
`paused`, `rejected`, or `banned` do not count toward the limit.

**Rotation weight** is a relative probability used by the public ad
carousel. A weight of 25 does not guarantee 25× the impressions of a
weight of 1 in every session; it means that over many sessions, that ad
will be selected roughly 25 times more often than a Free-tier ad. Actual
delivery depends on how many other ads are eligible at the moment.

Duration: paid plans are 30 days by default. The admin can grant longer.

---

## 2. What each plan unlocks

Every feature below is enforced by the database, not just displayed in
the UI.

**Free**
- 3 active ads
- 1× rotation weight
- Auto-created business profile at `/b/<slug>`
- Contact buttons on the profile (WhatsApp, phone, email)
- Basic dashboard statistics

**Starter**
- Everything in Free, plus:
- 5 active ads
- 3× rotation weight
- Business logo on the profile and on ad cards

**Standard**
- Everything in Starter, plus:
- 10 active ads
- 6× rotation weight
- Cover image on the business profile
- Custom brand colours (primary + accent) applied to the profile page
- Social links row (Facebook, Instagram, TikTok, YouTube, Website)

**Business**
- Everything in Standard, plus:
- 20 active ads
- 12× rotation weight
- Custom profile URL (the advertiser chooses their slug)
- Verified badge on the business profile and next to their business name
  on ad cards and ad pages

**Premium**
- Everything in Business, plus:
- 40 active ads
- 25× rotation weight (highest eligible priority)

---

## 3. What is *not* a plan feature

The following are sometimes mentioned in advertiser materials but are
**not** implemented as tier-dependent features. Do not describe them as
plan benefits:

- **Guaranteed placement.** No plan guarantees a specific position or a
  specific number of impressions. Rotation is weighted random.
- **"Always featured".** No such thing. Premium ads have the highest
  weight; they are not always shown.
- **Interstitial slots.** There is one interstitial type (the rotating
  carousel band). Every plan is eligible for it. Higher tiers win more
  of the rotations because of weight, not because the slot is reserved.
- **Popup exposure.** The sponsored popup uses the same carousel data
  and the same weights. It is not gated by plan.
- **Featured on share pages.** Share pages (`/ad/<slug>` and
  `/b/<slug>`) list the advertiser's own approved ads. No plan gets
  preferential treatment on another advertiser's page.
- **Advanced analytics.** All plans see the same dashboard statistics
  today (impressions, clicks, CTR, profile views). No plan has extra
  analytics.

---

## 4. How ads are delivered

1. On every shop page load, the client fetches ads from Supabase where
   `status = 'approved'`, `placement = 'carousel'`, and the ad is within
   its start/end date window.
2. The client performs a weighted random shuffle using each ad's
   `weight` column.
3. The result is split across two interstitial carousels, plus one slot
   in the popup.
4. Each ad's `weight` is set by the database on insert (from the
   advertiser's current effective tier) and updated by the database
   whenever the advertiser's tier or expiry date changes.

The weight column is authoritative on the server. The client never sends
a weight value that the server trusts.

---

## 5. How plans are granted and revoked

Only admins can change a plan. This is enforced by a database trigger
(`advertisers_guard_protected`) that rejects any change to `tier`,
`status`, `verified_email`, `verified_phone`, `tier_started_at`, or
`tier_expires_at` from a non-admin session.

### Granting a plan

1. The advertiser contacts PhoneYa2 (WhatsApp / call / email) using the
   upgrade buttons in their dashboard.
2. They pay.
3. An admin signs in at `/ads-admin/`, opens the Advertisers tab, clicks
   **Plan** on the advertiser's row, picks the tier and the duration,
   and saves.

The admin action writes `tier`, `tier_started_at`, and `tier_expires_at`
on the advertiser's row. A database trigger then:

- Sets the `weight` of every one of that advertiser's active ads to the
  tier's rotation weight.
- Records the change in the moderation log.

### Expiring a plan

When a paid plan's expiry date passes, the advertiser is treated as
**Free** for feature access. This is enforced by the SQL function
`effective_tier()` and its per-advertiser variant
`effective_tier_for(advertiser_id)`.

**[DECIDE: describe the expiry sweep behaviour once Step 3b is in place.
Today, expiry is applied lazily — i.e. the advertiser is treated as Free
in feature checks, but their ads keep their paid weight until an admin
touches their row or the expiry sweep runs.]**

### Revoking a plan

An admin can revoke a plan to Free at any time from the Plan modal. The
system then:

- Sets `tier` to `free`.
- Recomputes every active ad's weight to 1.
- If the advertiser has more than 3 active ads, pauses the ones beyond
  the 3 most recently created. The paused ads are preserved — they are
  not deleted, and they can be reactivated by upgrading again.

---

## 6. Moderation

Every ad passes through moderation. The lifecycle is:

    pending  →  approved  (live)
             ↘  rejected  (with a reason shown to the advertiser)

Admins can also move a live ad to `paused` (temporarily deactivated by
the admin) or `banned` (permanently removed, cannot be edited by the
advertiser).

Advertisers can edit their own ads while those ads are in `pending` or
`approved` state. Editing an approved ad returns it to `pending` for
re-review.

The admin queue at `/ads-admin/` shows every pending ad with its media,
title, description, destination, and submit time. Approve and reject are
one click each. Reject requires a reason; the reason is stored and shown
to the advertiser on their dashboard.

---

## 7. Active-ad limit

Each plan has a maximum count of active ads (`pending` + `approved`).
This limit is enforced by a database trigger (`ads_guard_ad_limit`).
When an advertiser at their limit tries to create another ad, the insert
is rejected with:

    Active ad limit reached for your plan (N of M). Upgrade for more,
    or pause/remove an existing ad.

Pausing an ad frees a slot. Admins bypass the limit.

---

## 8. Business profiles

Every advertiser gets a public profile at `/b/<slug>`:

- The slug is auto-generated from the business name at signup and made
  unique.
- Free tier: basic page with business name, contact buttons, and the
  advertiser's approved ads.
- Starter tier: adds a business logo.
- Standard tier: adds a cover image, custom brand colours, and a row of
  social links.
- Business tier: allows changing the slug (custom URL) and adds the
  verified badge.
- Premium tier: inherits Business features.

Profile features are enforced by the `profiles_guard_tier_fields` trigger,
which reads the advertiser's effective tier via `effective_tier()`. A
Free-tier advertiser cannot set custom colours, a cover image, social
links, or a custom slug even by calling the API directly.

Profile views are recorded in `advertiser_profile_views` and counted on
the `advertiser_profiles.view_count` column. Advertisers can see their
view count on the dashboard. They cannot modify it directly.

---

## 9. Analytics

Impressions and clicks are recorded per ad in `ad_impressions` and
`ad_clicks`. Each row carries a `visitor_hash` (a hash of the visitor's
user-agent, language, and the day, generated client-side), a `placement`
value, and a `source` value derived from the referrer.

Advertisers see, per ad: impressions, clicks, and CTR (`clicks /
impressions * 100`). They also see profile views, and a source breakdown
(adshare, WhatsApp, Facebook, Instagram).

Impression and click rows are readable only by the ad's owner and by
admins. Anyone with the anon key can insert a row with a valid
`visitor_hash`; that is by design, because impressions are recorded from
anonymous visitors. There is no deduplication beyond the visitor_hash
itself, and no rate limit.

---

## 10. What's not built yet (Roadmap)

The following have been discussed but are **not** implemented. They must
not be advertised or promised to advertisers until they are enforced
server-side and this README is updated:

- Online payment and self-service plan upgrades.
- Automatic expiry sweep (Step 3b). Today, expiry is applied to feature
  access immediately but does not by itself recompute ad weight.
- Any plan-differentiated analytics beyond what all plans see today.
- Any plan-differentiated placements beyond the single carousel
  (`placement = 'carousel'`).
- Video ads as a plan feature. Video ads are supported as a media type
  for any plan.
- Referral rewards. The `ad_referrals` table exists but no code reads it.
- Custom targeting (category, geography, time-of-day).
- A/B testing of ad creative.
- Automated business verification (TIN, licence).

---

## 11. Architecture summary

- **Frontend:** static HTML/CSS/JS. No build step.
- **Hosting:** Cloudflare Pages, with `functions/` providing server-side
  rendering for `/ad/<slug>` and `/b/<slug>`.
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions).
- **Auth:** Supabase email/password. Sessions live in `sessionStorage`
  under the key `py2ads_session`.
- **Client config:** `ads-config.js` exposes `window.py2Ads` with thin
  wrappers over Supabase REST and Auth. All client calls use the
  publishable key only. The service-role key is used exclusively by the
  `signup-advertiser` Edge Function, which runs server-side.

---

## 12. Admin operations

The admin panel is at `/ads-admin/`. Tabs:

- **Queue** — pending ads, with approve/reject/ban actions.
- **Advertisers** — every advertiser, with plan status and a link to
  the Plan modal.
- **Plans** — advertisers sorted by plan status, expiring soonest first.
- **Expiring** — advertisers whose paid plan expires in the next 14 days
  or has already expired, with a WhatsApp quick-contact link.
- **All Ads** — every ad across all advertisers, filterable by status.
- **Reports** — ads reported by users, with a resolve/dismiss flow.
- **Log** — recent moderation actions.
- **Analytics** — top-performing ads and traffic source breakdown.

Admins authenticate with a Supabase account whose `profiles.role` is
`'admin'`. Any other account sees an "access required" screen.
