# PhoneYa2 system audit — initial evidence-backed baseline

**Audit date:** 2026-10-19  
**Scope:** Repository files inspected on `build/phoneya2-major-premium-2026-10-19` and current draft PR #36. This is an initial code/configuration audit, not a production acceptance certificate.

## Executive status

- **Production branch:** PR #36 targets `main`; the draft branch is not production and is not merged.
- **Primary public origin configured in source:** `https://phoneya2.pages.dev`.
- **CMS:** Decap CMS at `/admin/`; `admin/config.yml` points to GitHub repository `BLESSTech-X/BlessTech-X-Accessories`, branch `main`, content under `content/products` and media under `assets/images/uploads`. Publishing is GitHub-backed; keep this workflow intact.
- **Runtime:** Cloudflare Pages Functions are configured through `_routes.json` for `/api/*`, `/product.html`, `/blog-post.html`, `/b/*`, and `/ad/*`. This route file alone does not prove every route is healthy in production.
- **Orders:** `functions/api/orders.js` recalculates product/price/stock from published catalog files and uses server-side Supabase credentials for persistence and admin identity checks. Email and order alerts are provider/configuration dependent. No live order or payment was tested.
- **Blog comments:** `functions/api/blog-comments.js` uses a GitHub content branch named `community-comments`. The API needs its configured GitHub access secret and branch/repository permissions. Comments are not proven live until preview and production configuration are verified.
- **Deployment:** PR #36 remains draft/unmerged. Previous Vercel checks reported a build-rate-limit/plan-limit failure. That is not evidence of a successful build or a source-code failure; Cloudflare preview status still needs direct verification.
- **Data protection:** No database migration, production record edit, payment change, or commission-rule change was made in this increment.

## Architecture map (confirmed and unconfirmed boundaries)

| Component | Evidence found | Data/dependency | Status / limitation |
|---|---|---|---|
| Public storefront | Static HTML pages including home, shop, product, cart, checkout, account, blog and policies | Published assets and product index | Source exists; full browser regression testing remains outstanding |
| Content publishing | `admin/index.html`, `admin/config.yml` | Decap CMS → GitHub `main` → content files/build scripts | Configuration inspected; authentication/publish action not exercised |
| Product index | `build-product-index.js` | `content/products`, `content/blog` | Script source inspected; execution against complete checkout still needed |
| Sitemap | `generate-sitemap.js`, `robots.txt` | Product index, blog index, static routes | Duplicate policy URLs found and fixed in this branch; generated sitemap and Search Console fetch still unverified |
| Cloudflare Functions | `_routes.json`, `functions/api/orders.js`, `functions/api/blog-comments.js`, `functions/b/[slug].js` | Runtime bindings and secrets | Some route logic inspected; deployed bindings/secret values intentionally not inspected or exposed |
| Orders and customer emails | Order endpoint source | Product markdown/index; Supabase server secrets; Resend/Formspree/alert configuration | Catalog validation and message flows are present in code; persistence, duplicate idempotency, delivery, and notification success require targeted tests |
| Blog community | Blog comment endpoint + frontend | GitHub API, `community-comments` branch | Configuration-sensitive; not live-verified |
| Advertising | Registration and advertiser pages included in PR #36 | Advertiser API/data and plan permissions | Registration layout and mini-site preview are in current draft; complete ad lifecycle, billing, rotation, expiry and server-side permissions remain to be audited |
| Agent system | Not fully inspected in this pass | Active referral/order/commission source not yet established | **Unknown**; do not merge competing/legacy agent changes until authoritative data path is traced |
| Analytics | Not fully inspected in this pass | GA4/Search Console/AdSense and application events | **Unknown**; no claims of connected analytics or reliable profit reporting |
| Hosting | Source configuration and PR metadata | Cloudflare Pages and Vercel checks | Cloudflare production/preview deployment was not independently confirmed in this pass |

## Phase 1 findings and changes

### Fixed in this branch
1. `generate-sitemap.js` listed `/privacy-policy.html` and `/return-policy.html` twice. Removed the duplicate static entries.
2. Added URL deduplication across static pages, product entries and blog entries so overlapping sources cannot emit duplicate sitemap URLs.
3. Changed the summary log to report **unique URLs** rather than a raw list count.

### Why this matters
Duplicate URLs do not directly create a customer checkout failure, but they make sitemap output noisy and counts misleading. The fix is isolated to sitemap generation and does not alter product data or customer/order logic.

### Tests and release status
- Source-level inspection confirms the two duplicate static entries are gone and a URL deduplication guard is present.
- **Not yet verified:** running `node build-product-index.js && node generate-sitemap.js` in a full checkout, parsing the resulting XML, checking all generated URLs return successfully, Cloudflare preview behavior, Google Search Console fetch, and the complete customer purchase journey.
- **Rollback:** revert the commit that updates `generate-sitemap.js`; no data migration is involved.

## Prioritized execution backlog

| Priority | Work | Business / risk reason | Verification gate |
|---|---|---|---|
| P0 | Validate order persistence, idempotency, server-side totals, stock races, admin authorization and notification failure handling | Prevent lost/duplicate orders and false financial records | Isolated staging tests with fake orders; no live payment/customer records |
| P0 | Verify secrets, API authorization and rate/spam controls across Functions | Protect customer and business data | Endpoint-by-endpoint auth and negative tests; never print secret values |
| P1 | Run product-index + sitemap build and validate XML and generated links | Product discoverability and indexing | Build succeeds; XML parses; URL uniqueness asserted |
| P1 | Establish canonical order/referral/commission data flow before changing agent dashboards | Avoid double commissions or conflicting historical systems | Trace order → attribution → eligibility → payable → paid using test records |
| P1 | Audit advertiser plan enforcement on the server, preview routing, impression/click dedupe and publication lifecycle | Protect paid value and prevent misleading campaign stats | Free/paid permission matrix + test ad lifecycle |
| P1 | Reconcile GA4/Search Console/AdSense with app-level events and clearly label unavailable data | Decisions must use trustworthy metrics | Event dictionary, source-of-truth map and duplicate-event tests |
| P2 | Verify Decap product/blog publish flow from phone and desktop | Prevent broken content operations | Publish a disposable/test item on a non-production branch and verify generated output |
| P2 | Complete mobile/desktop regression checks for PR #36 | Protect existing customer journeys | Browser checks on key pages at narrow and wide viewport sizes |
| P2 | Add opt-in B2B enquiry and retention experiments only after baseline events work | Growth without vanity metrics | Defined funnel and measurable experiment; no guaranteed revenue claims |

## Core metric dictionary (definitions to adopt)

| Metric | Definition | Source of truth | Status |
|---|---|---|---|
| Product views | Count of valid product-detail views; exclude duplicate instrumentation for one page view | GA4/app event stream | Source mapping not yet verified |
| Search usage | Searches submitted, with empty/invalid searches separated | App event stream | Instrumentation not yet verified |
| Add-to-cart rate | Sessions with ≥1 add-to-cart ÷ eligible sessions | GA4/app event stream | Not yet verified |
| Checkout-start rate | Sessions that begin checkout ÷ sessions with cart intent | GA4/app event stream | Not yet verified |
| Orders submitted | Unique persisted order IDs created | Order store/API | Persistence and idempotency need tests |
| Confirmed orders | Unique orders explicitly reviewed/confirmed | Authoritative order store | Must not be inferred from submission |
| Revenue | Sum of confirmed/paid order value according to a documented status policy | Authoritative order records | Payment verification policy not yet established |
| Gross profit | Revenue less product acquisition cost for the units sold | Order lines + verified product costs | Costs may be missing; do not treat missing cost as zero |
| Contribution profit | Revenue less product cost, commissions, delivery, payment fees, discounts/refunds and attributable campaign cost | Financial ledger/order cost data | Not currently validated |
| Agent conversion | Unique qualified orders attributed to an agent ÷ eligible unique agent referrals | One authoritative attribution system | Agent source not yet established |
| Payable commission | Commission on eligible, non-cancelled orders under the approved rule, less reversals | Commission ledger/order state | Rules and ledger require audit |
| Ad CTR | Deduplicated valid ad clicks ÷ eligible measured impressions | Advertising event store | Event validity/dedupe not verified |
| Advertiser revenue | Verified payments received for ads, not advertised plan price or draft invoice | Payment records | Payment verification not established |
| Organic search clicks | Search clicks reported by Search Console for the selected period | Google Search Console | Live connector/status not checked |

## Open blockers / next action

1. Run the product index and sitemap generation in a full repository checkout; add automated assertions for duplicate URLs and malformed XML.
2. Trace order create/update code end-to-end and test duplicate submission, stock changes, and authorization without touching live customer records.
3. Inspect the active agent and advertiser API/data stores before editing their business logic.
4. Verify the actual Cloudflare preview deployment and test the draft there. Do not merge based only on a Git commit or CSS syntax.
5. Check GA4, Search Console and AdSense status using authorized integrations or dashboards; keep missing data explicitly marked unavailable.

**Completion rule:** This document is an initial evidence-backed baseline. It is not a declaration that the full-system audit or upgrade is complete.
