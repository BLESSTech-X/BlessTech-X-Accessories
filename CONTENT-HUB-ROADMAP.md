# PhoneYa2 Content Hub — Implementation Plan

## Phase 1: Blog and offer publishing foundation (this branch)
- Decap CMS collection **Blog & Updates** with title, date, category, excerpt, cover image, author, featured flag, publish toggle, tags, related product slugs and Markdown body.
- The existing `build-product-index.js` continues generating the product index and also creates a published-only `content/blog/index.json`.
- Public blog feed supports category filters, search, article detail pages and related product links.
- Latest published posts can appear on the homepage, shop, product, about and contact pages.
- The existing sitemap generator includes the blog and published articles.
- Cloudflare Pages Function supplies article-specific Open Graph/Twitter metadata for link previews.
- Existing advertiser Ads system is reused for labelled sponsored content; ad impressions and clicks are recorded using the existing tables.
- A delayed, dismissible PhoneYa2 product spotlight is frequency-capped to at most once per visitor per 24 hours.
- GA4 events record blog views, filters, searches, article opens, shares, teaser clicks, sponsored-ad engagement and product spotlight engagement.

## Phase 2: Moderated community comments and Command Centre reporting
- Decap/GitHub is for owner-managed editorial content, not a public comment database. Do not store visitor comments as commits.
- Add a dedicated Supabase table for comments. New comments must default to **pending**; only approved comments are public.
- Add owner-only moderation controls in the Command Centre (approve, reject, hide, delete, report queue, spam controls).
- Add a content analytics panel in the Command Centre. Blog engagement events must be visible there, not only in external GA4 reports.
- Any GA4 Data API integration must use a server-side Cloudflare Function and a securely stored service credential; never expose secrets in browser code.
- Apply the Supabase schema migration before enabling comments or dashboard queries that depend on the new tables.

## Phase 3: Retention and discovery
- Add tags, related articles, “continue reading,” editorial series and seasonal offer collections.
- Add notification/subscription options only with explicit consent and unsubscribe controls.
- Improve SEO for published articles: canonical URLs, article schema, internal links and search-console monitoring.
- Review actual engagement and conversion before adding more mechanics.

## Product principles
- No deceptive urgency, fake engagement, forced pop-ups or autoplay audio.
- Sponsored content must be labelled.
- Product promotion pop-ups are dismissible, delayed, scroll-triggered and frequency-capped.
- Motion respects reduced-motion preferences.
- Content feed fails quietly if unavailable so it cannot break checkout, product pages or the existing storefront.
- Do not merge to production until build checks and a manual mobile smoke test pass.
