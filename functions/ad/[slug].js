/* ═══════════════════════════════════════════════════════════════════════════
   Cloudflare Pages Function — GET /ad/:slug
   ────────────────────────────────────────────────────────────────────────
   Renders the shareable ad page with OG meta tags prerendered so
   WhatsApp / Facebook / Twitter / LinkedIn produce rich preview cards.

   Route: /ad/:slug
   Cloudflare Pages automatically routes /ad/anything-here to this file
   because it lives at functions/ad/[slug].js. No config file required.

   Data source: Supabase REST API (publishable key — safe on the server).

   If you are on Netlify instead, tell me — the file format differs slightly.
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Config ────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://signnapmkdctdcfpnsiu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BwOe5fD2oK-hz1LtPNmslw_9EaBZNUD';
const SITE_URL     = 'https://phoneya2.pages.dev';
const FALLBACK_OG_IMAGE = 'https://i.ibb.co/s9CG52wV/file-0000000059948211a0bdd52c4d236852-1.jpg';

// ── Helpers ───────────────────────────────────────────────────────────────
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ctaFor(ad) {
  const t = ad.destination_type;
  const u = ad.destination_url || '';
  if (t === 'whatsapp') {
    const digits = String(u).replace(/[^\d]/g, '');
    return { label: 'Chat on WhatsApp', href: 'https://wa.me/' + digits, icon: 'whatsapp', isBrand: true };
  }
  if (t === 'website')   return { label: 'Visit Website',     href: u, icon: 'globe',     isBrand: false };
  if (t === 'facebook')  return { label: 'View on Facebook',  href: u, icon: 'facebook-f',isBrand: true };
  if (t === 'instagram') return { label: 'View on Instagram', href: u, icon: 'instagram', isBrand: true };
  if (t === 'tiktok')    return { label: 'View on TikTok',    href: u, icon: 'tiktok',    isBrand: true };
  if (t === 'youtube')   return { label: 'Watch on YouTube',  href: u, icon: 'youtube',   isBrand: true };
  return { label: 'View Deal', href: u, icon: 'globe', isBrand: false };
}

// ── Data fetchers ─────────────────────────────────────────────────────────
async function fetchAd(slug) {
  const qs =
    'ads?select=id,slug,title,description,media_url,destination_type,destination_url,status,start_date,end_date,advertiser_id,advertisers(business_name,logo_url)' +
    '&slug=eq.' + encodeURIComponent(slug) +
    '&limit=1';

  const r = await fetch(SUPABASE_URL + '/rest/v1/' + qs, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Accept': 'application/json'
    }
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows && rows[0] ? rows[0] : null;
}

async function fetchOtherAds(excludeAdId) {
  const nowIso = new Date().toISOString();
  const qs =
    'ads?select=id,slug,title,media_url,advertisers(business_name)' +
    '&status=eq.approved' +
    '&placement=eq.carousel' +
    '&start_date=lte.' + encodeURIComponent(nowIso) +
    '&or=(end_date.is.null,end_date.gt.' + encodeURIComponent(nowIso) + ')' +
    '&id=neq.' + encodeURIComponent(excludeAdId) +
    '&order=weight.desc,created_at.desc' +
    '&limit=6';

  const r = await fetch(SUPABASE_URL + '/rest/v1/' + qs, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Accept': 'application/json'
    }
  });
  if (!r.ok) return [];
  return (await r.json()) || [];
}

// ── Full HTML shell ───────────────────────────────────────────────────────
function renderShell({ title, description, ogImage, canonicalUrl, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-MVNT6SQCS2"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-MVNT6SQCS2');
  </script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="theme-color" content="#ff6000">
  <meta name="robots" content="noindex,follow">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="PhoneYa2 Ads">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${esc(canonicalUrl)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(ogImage)}">

  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="/ads-shared.css">
  <style>
    body.ad-page {
      background: #f8f9ff;
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      color: #1a1a2e;
      margin: 0;
      padding-bottom: 60px;
      -webkit-font-smoothing: antialiased;
    }
    .ad-page .wrap { max-width: 760px; margin: 0 auto; padding: 24px 16px 40px; }
    .ad-page .topbar-mini {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 0 18px; flex-wrap: wrap; gap: 10px;
    }
    .ad-page .brand-link {
      display: flex; align-items: center; gap: 8px;
      font-family: 'Syne', system-ui, sans-serif; font-weight: 800; font-size: 15px;
      text-decoration: none; color: #1a1a2e;
    }
    .ad-page .brand-link span { color: #ff6000; }

    .ad-hero {
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,.08);
      border: 1px solid rgba(0,0,0,.06);
      margin-bottom: 20px;
    }
    .ad-hero-img {
      width: 100%; aspect-ratio: 16 / 9; object-fit: cover;
      background: #f8f9ff; display: block;
    }
    .ad-hero-img-fallback {
      width: 100%; aspect-ratio: 16/9;
      display: flex; align-items: center; justify-content: center;
      background: #f8f9ff; font-size: 3rem;
    }
    .ad-hero-body { padding: 22px 22px 24px; }
    .ad-sponsor-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .ad-sponsor-logo {
      width: 44px; height: 44px; border-radius: 10px;
      background: #f8f9ff; object-fit: cover;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.2rem; flex-shrink: 0;
    }
    .ad-sponsor-name {
      font-family: 'Syne', system-ui, sans-serif;
      font-weight: 700; font-size: 14px; color: #ff6000;
      text-transform: uppercase; letter-spacing: .6px;
    }
    .ad-sponsor-tag {
      display: inline-block; background: rgba(10,10,20,.75); color: white;
      font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 100px;
      text-transform: uppercase; letter-spacing: .5px;
    }
    .ad-title-big {
      font-family: 'Syne', system-ui, sans-serif;
      font-weight: 800; font-size: clamp(1.4rem, 4vw, 2rem);
      line-height: 1.15; margin-bottom: 10px;
    }
    .ad-desc-big {
      font-size: 15px; line-height: 1.65; color: #444; margin-bottom: 20px;
    }
    .ad-cta-big {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      background: linear-gradient(135deg,#ff6000,#ff9f43);
      color: white; font-weight: 700; font-size: 16px;
      padding: 16px 24px; border-radius: 12px;
      text-decoration: none; width: 100%; box-sizing: border-box;
      box-shadow: 0 4px 20px rgba(255,96,0,.35);
      transition: transform .2s, box-shadow .2s;
    }
    .ad-cta-big:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(255,96,0,.5); }
    .ad-cta-big i { font-size: 1.15rem; }

    .ad-report-row {
      text-align: center; margin-top: 14px;
      font-size: 12px; color: #6b7280;
    }
    .ad-report-row a {
      color: #6b7280; text-decoration: underline; cursor: pointer;
    }

    .more-section { margin-top: 26px; }
    .more-section h2 {
      font-family: 'Syne', system-ui, sans-serif;
      font-weight: 800; font-size: 1.15rem; margin-bottom: 4px;
    }
    .more-section p.sub { font-size: 13px; color: #6b7280; margin-bottom: 14px; }
    .more-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;
    }
    .more-card {
      background: white; border-radius: 12px; overflow: hidden;
      border: 1px solid rgba(0,0,0,.06); text-decoration: none; color: inherit;
      box-shadow: 0 2px 12px rgba(0,0,0,.05);
      transition: transform .2s, box-shadow .2s;
      display: flex; flex-direction: column;
    }
    .more-card:hover { transform: translateY(-3px); box-shadow: 0 4px 20px rgba(0,0,0,.08); }
    .more-card-img { aspect-ratio: 16/9; background: #f8f9ff; overflow: hidden; }
    .more-card-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .more-card-body { padding: 10px 12px 12px; }
    .more-card-biz {
      font-size: 10px; font-weight: 700; color: #ff6000;
      text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .more-card-title {
      font-family: 'Syne', system-ui, sans-serif;
      font-weight: 700; font-size: 13.5px; line-height: 1.3;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .advertise-strip {
      margin-top: 30px; background: #0a0a14; color: white;
      border-radius: 16px; padding: 22px 20px;
      display: flex; align-items: center; justify-content: space-between;
      gap: 16px; flex-wrap: wrap;
    }
    .advertise-strip h3 {
      font-family: 'Syne', system-ui, sans-serif;
      font-weight: 800; font-size: 1.05rem; margin: 0 0 4px;
    }
    .advertise-strip p {
      font-size: 13px; color: rgba(255,255,255,.6); margin: 0; line-height: 1.5;
    }
    .advertise-strip a {
      background: linear-gradient(135deg,#ff6000,#ff9f43);
      color: white; font-weight: 700;
      padding: 10px 18px; border-radius: 10px;
      text-decoration: none; white-space: nowrap; font-size: 14px;
    }
    .empty {
      text-align: center; padding: 80px 20px;
      background: white; border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,.05);
    }
    .empty-icon { font-size: 3rem; margin-bottom: 12px; }
    .empty h1 {
      font-family: 'Syne', system-ui, sans-serif;
      font-weight: 800; font-size: 1.5rem; margin-bottom: 8px;
    }
    .empty p { color: #6b7280; font-size: 14px; margin-bottom: 20px; }
    .btn-primary {
      display: inline-flex; align-items: center; gap: 8px;
      background: linear-gradient(135deg,#ff6000,#ff9f43);
      color: white; font-weight: 700; font-size: 14px;
      padding: 12px 22px; border-radius: 10px;
      text-decoration: none; box-shadow: 0 4px 16px rgba(255,96,0,.35);
    }
  </style>
</head>
<body class="ad-page">
${bodyHtml}
<script src="/ads-config.js"></script>
<script>
  (function () {
    'use strict';
    var P = window.py2Ads;
    if (!P) return;

    var AD_ID = window.__PY2_AD_ID__;
    if (!AD_ID) return;

    // Record impression
    P.visitorHash().then(function (vh) {
      return fetch(P.config.url + '/rest/v1/ad_impressions', {
        method: 'POST',
        headers: {
          'apikey':        P.config.key,
          'Authorization': 'Bearer ' + P.config.key,
          'Content-Type':  'application/json',
          'Prefer':        'return=minimal'
        },
        body: JSON.stringify({
          ad_id:        AD_ID,
          visitor_hash: vh,
          placement:    'share',
          source:       P.detectSource()
        })
      }).catch(function () {});
    });

    // CTA click
    var cta = document.getElementById('ad-cta');
    if (cta) {
      cta.addEventListener('click', function () {
        P.visitorHash().then(function (vh) {
          return fetch(P.config.url + '/rest/v1/ad_clicks', {
            method: 'POST',
            headers: {
              'apikey':        P.config.key,
              'Authorization': 'Bearer ' + P.config.key,
              'Content-Type':  'application/json',
              'Prefer':        'return=minimal'
            },
            body: JSON.stringify({
              ad_id:        AD_ID,
              visitor_hash: vh,
              placement:    'share',
              source:       P.detectSource()
            })
          }).catch(function () {});
        });
      });
    }

    // Report link
    var report = document.getElementById('ad-report');
    if (report) {
      report.addEventListener('click', function (e) {
        e.preventDefault();
        var reason = window.prompt(
          'Report this ad.\\n\\nPlease type a short reason (e.g. "misleading", "scam", "adult content"):',
          ''
        );
        if (!reason || !reason.trim()) return;
        P.visitorHash().then(function (vh) {
          return fetch(P.config.url + '/rest/v1/ad_reports', {
            method: 'POST',
            headers: {
              'apikey':        P.config.key,
              'Authorization': 'Bearer ' + P.config.key,
              'Content-Type':  'application/json',
              'Prefer':        'return=minimal'
            },
            body: JSON.stringify({
              ad_id:        AD_ID,
              reason:       reason.trim().slice(0, 120),
              visitor_hash: vh
            })
          });
        }).then(function () {
          window.alert('Thank you. Our team will review this ad.');
        }).catch(function () {
          window.alert('Could not submit report right now.');
        });
      });
    }
  })();
</script>
</body>
</html>`;
}

// ── Not-found page ────────────────────────────────────────────────────────
function notFoundPage(slug) {
  const body = `
    <div class="wrap">
      <div class="empty">
        <div class="empty-icon">🔍</div>
        <h1>Ad not found</h1>
        <p>This ad doesn't exist, has been removed, or hasn't been approved yet.</p>
        <a class="btn-primary" href="/">Browse PhoneYa2</a>
      </div>
    </div>`;
  return new Response(renderShell({
    title: 'Ad not found — PhoneYa2',
    description: 'This ad does not exist or is no longer available.',
    ogImage: FALLBACK_OG_IMAGE,
    canonicalUrl: SITE_URL + '/ad/' + encodeURIComponent(slug || ''),
    bodyHtml: body
  }), {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}

// ── Main handler ──────────────────────────────────────────────────────────
export async function onRequestGet(context) {
  const { params } = context;
  const slug = params && params.slug;

  if (!slug || typeof slug !== 'string') {
    return notFoundPage('');
  }

  // Fetch ad
  let ad;
  try {
    ad = await fetchAd(slug);
  } catch (e) {
    return new Response('Error loading ad', { status: 502 });
  }

  // Visibility check
  if (!ad) return notFoundPage(slug);
  const now = new Date();
  const startOk = !ad.start_date || new Date(ad.start_date) <= now;
  const endOk   = !ad.end_date   || new Date(ad.end_date)   >  now;
  if (ad.status !== 'approved' || !startOk || !endOk) {
    return notFoundPage(slug);
  }

  // Fetch other approved ads (silent failure OK)
  let others = [];
  try {
    others = await fetchOtherAds(ad.id);
  } catch (e) { /* silent */ }

  // Build values
  const biz       = (ad.advertisers && ad.advertisers.business_name) || 'Zambian Business';
  const bizLogo   = (ad.advertisers && ad.advertisers.logo_url)      || '';
  const cta       = ctaFor(ad);
  const canonical = SITE_URL + '/ad/' + encodeURIComponent(ad.slug);
  const heroImg   = ad.media_url || FALLBACK_OG_IMAGE;
  const ogTitle   = ad.title + ' — ' + biz + ' | PhoneYa2 Ads';
  const ogDesc    = (ad.description || 'Discover this Zambian business on PhoneYa2.').slice(0, 160);
  const ogImg     = heroImg;

  const heroImgHtml = ad.media_url
    ? `<img class="ad-hero-img" src="${esc(ad.media_url)}" alt="${esc(ad.title)}" onerror="this.outerHTML='<div class=\\'ad-hero-img-fallback\\'>🖼️</div>'">`
    : `<div class="ad-hero-img-fallback">🖼️</div>`;

  const logoHtml = bizLogo
    ? `<img class="ad-sponsor-logo" src="${esc(bizLogo)}" alt="${esc(biz)}">`
    : `<div class="ad-sponsor-logo">🏢</div>`;

  const moreHtml = others.length
    ? `<div class="more-section">
        <h2>🇿🇲 Discover other Zambian businesses</h2>
        <p class="sub">More sponsored businesses on PhoneYa2</p>
        <div class="more-grid">
          ${others.map(o => {
            const oBiz = (o.advertisers && o.advertisers.business_name) || 'Zambian Business';
            const img = o.media_url
              ? `<img src="${esc(o.media_url)}" alt="${esc(o.title)}" loading="lazy">`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.6rem;background:#f5f5f5">🇿🇲</div>`;
            return `
              <a class="more-card" href="/ad/${esc(o.slug)}">
                <div class="more-card-img">${img}</div>
                <div class="more-card-body">
                  <div class="more-card-biz">${esc(oBiz)}</div>
                  <div class="more-card-title">${esc(o.title)}</div>
                </div>
              </a>`;
          }).join('')}
        </div>
      </div>`
    : '';

  const iconPrefix = cta.isBrand ? 'brands' : 'solid';

  const bodyHtml = `
    <div class="wrap">
      <div class="topbar-mini">
        <a class="brand-link" href="/">
          <span style="font-size:22px;">📱</span>
          <div>PhoneYa2 <span>Ads</span></div>
        </a>
        <a href="/shop.html" style="font-size:13px;color:#ff6000;font-weight:600;text-decoration:none;">
          Shop accessories <i class="fa-solid fa-arrow-right"></i>
        </a>
      </div>

      <div class="ad-hero">
        ${heroImgHtml}
        <div class="ad-hero-body">
          <div class="ad-sponsor-row">
            ${logoHtml}
            <div style="min-width:0;flex:1;">
              <div class="ad-sponsor-name">${esc(biz)}</div>
              <div style="margin-top:2px;"><span class="ad-sponsor-tag">Sponsored</span></div>
            </div>
          </div>

          <h1 class="ad-title-big">${esc(ad.title)}</h1>
          ${ad.description ? `<p class="ad-desc-big">${esc(ad.description)}</p>` : ''}

          <a id="ad-cta" class="ad-cta-big" href="${esc(cta.href)}" target="_blank" rel="noopener">
            <i class="fa-${iconPrefix} fa-${cta.icon}"></i>
            ${esc(cta.label)}
          </a>

          <div class="ad-report-row">
            <a id="ad-report" href="#">Report this ad</a>
          </div>
        </div>
      </div>

      ${moreHtml}

      <div class="advertise-strip">
        <div>
          <h3>Want your business here?</h3>
          <p>Advertise on PhoneYa2 and reach Zambian shoppers. Free to start.</p>
        </div>
        <a href="/advertise/">Advertise →</a>
      </div>
    </div>

    <script>
      window.__PY2_AD_ID__   = ${JSON.stringify(ad.id)};
      window.__PY2_AD_SLUG__ = ${JSON.stringify(ad.slug)};
    </script>
  `;

  const html = renderShell({
    title: ogTitle,
    description: ogDesc,
    ogImage: ogImg,
    canonicalUrl: canonical,
    bodyHtml
  });

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=300'
    }
  });
}
