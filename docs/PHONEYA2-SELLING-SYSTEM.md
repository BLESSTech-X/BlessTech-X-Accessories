# PhoneYa2 selling system — Decap operating guide

This guide explains how to run the conversion features without editing site code. Product and article content remains managed through Decap CMS.

## 1. Product offer controls

Open Decap CMS → Products. Each product can now use:

- **Selling Price (ZMW):** the current price a buyer pays.
- **Original / Reference Price (ZMW):** only a genuine previous/reference price. The site calculates savings from this field when it is higher than the selling price. Do not use a made-up comparison price.
- **Sales Hook:** one short, verifiable customer benefit. Lead with the use case; do not claim features that are not confirmed.
- **Offer Badge:** a short label such as “Budget Pick”, “Featured Pick”, or “Charging Essential”. It is a label, not proof of a discount.
- **Offer Details:** compatibility notes, what is included, delivery/availability reminders, bundle conditions or a real end date.
- **Sales Priority:** Standard, Promote More, or Seasonal / Campaign. Higher priorities are surfaced earlier in the homepage “Just For You” picks, the default shop ordering and agent recommendations.

Only use “limited time”, “last units”, a discount amount or “free” when the stock, price and terms actually support the claim. Keep the stock field current. The site cannot make a product available for sale if its stock is zero.

## 2. Blog that helps customers decide

Open Decap CMS → Blog & Updates. Publish useful answers, buying guides, product comparisons and honest offer announcements. Use **Featured Products** to select catalogue products related to the article and add a caption explaining why each product fits the story.

The blog feed now gives featured products a stronger product/price cue and a clear path to the product page. The full article repeats the featured products with their sales hook, offer badge/details and a Buy Now link. The general blog product-picks section prioritizes promoted, campaign and featured in-stock items from the generated catalogue.

A good sales article answers the customer's question first, explains what to check, then links to a relevant product. Do not turn every article into an unrelated sales pitch.

## 3. Agent Desk: choose, calculate, share

The PY2-360 desk now prioritizes products marked Promote More and Seasonal / Campaign, then featured items. Product cards show the current catalogue price, stock, sales hook, offer notes and a “Sell this & share” message. Search products by name, offer or benefit.

The calculator estimates:
- commission for one sale;
- estimated commission for the selected number of sales; and
- how many sales would be needed to reach a chosen commission target.

The estimator uses the existing fallback commission tiers in agents/config.js: K1–K100 = 10%, K101–K500 = 8%, K501–K1,000 = 6%, K1,001–K5,000 = 4%, and K5,001+ = 3%, with the current code rounding each estimate to a whole kwacha. It clearly labels results as estimates because active database commission tiers may differ. Confirm the active commission rule before promising a rate to agents.

## 4. Simple weekly operating rhythm

1. Check current stock and prices before promoting anything.
2. Select 3–5 products for the week: a low-price option, a popular/featured item and a campaign product if a real campaign exists.
3. Add clear sales hooks and honest offer details in Decap.
4. Publish one useful blog article and connect relevant products through Featured Products.
5. Ask agents to choose products that fit the audiences they can reach; have them use the calculator and share the product page, not a screenshot without a buying link.
6. Review real orders and enquiries. Do not count page views, clicks or shares as sales.
7. Keep contact capture permission-based and respect opt-outs.

## 5. Known measurement boundary

Agent product shares can include a personal referral code entered in the Agent Desk (if PhoneYa2 has issued one to that agent). The product page captures it and checkout sends it to the order endpoint, which records it in the existing order-note field as `Agent referral code (verify before crediting): CODE` when the current order RPC supports customer notes. This avoids a database migration, but it is a lead-tracking hint only: it is not independently verified against the agent register and does not automatically calculate, confirm or pay commission. If the database's compatibility fallback omits notes, the referral hint may not persist. The current PY2-360 login is a shared access code, not an individual authenticated agent account.  Its commission calculator is a planning estimate, not a ledger or payout authorization. Do not report a shared store order as an agent's personal sale. Reliable personal commission tracking requires referral identifiers to survive the product visit and checkout and then be verified against confirmed orders.
