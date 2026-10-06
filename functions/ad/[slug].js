/* ═══════════════════════════════════════════════════════════════════════════
   Cloudflare Pages Function — GET /ad/:slug
   ────────────────────────────────────────────────────────────────────────
   Shareable ad page with OG tags prerendered.
   Now links prominently to the business profile at /b/<slug>.
   ═══════════════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = 'https://signnapmkdctdcfpnsiu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BwOe5fD2oK-hz1LtPNmslw_9EaBZNUD';
const SITE_URL     = 'https://phoneya2.pages.dev';
const FALLBACK_OG_IMAGE = 'https://i.ibb.co/s9CG52wV/file-0000000059948211a0bdd52c4d236852-1.jpg';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

async function fetchAd(slug) {
  const qs =
    'ads?select=id,slug,title,description,media_url,media_type,video_provider,destination_type,destination_url,status,start_date,end_date,advertiser_id,advertisers(id,business_name,logo_url)' +
    '&slug=eq.' + encodeURIComponent(slug) +
    '&limit=1';
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + qs, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Accept': 'application/json' }
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows && rows[0] ? rows[0] : null;
}

async function fetchAdvertiserProfile(advertiserId) {
  const qs =
    'advertiser_profiles?select=slug,tagline,about,primary_color,accent_color,verified,logo_url' +
    '&advertiser_id=eq.' + encodeURIComponent(advertiserId) +
    '&limit=1';
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + qs, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Accept': 'application/json' }
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows && rows[0] ? rows[0] : null;
}

async function fetchOtherBusinesses(excludeAdvertiserId) {
  const qs =
    'advertiser_profiles?select=slug,tagline,logo_url,verified,advertisers(business_name)' +
    '&advertiser_id=neq.' + encodeURIComponent(excludeAdvertiserId) +
    '&order=view_count.desc' +
    '&limit=6';
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + qs, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Accept': 'application/json' }
  });
  if (!r.ok) return [];
  return (await r.json()) || [];
}

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
      background: #0a0a14;
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      color: #e8e8f0;
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
      text-decoration: none; color: white;
    }
    .ad-page .brand-link span { color: #ff6000; }

    .ad-hero {
      background: linear-gradient(160deg, #12122a, #0a0a14);
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,.08);
      box-shadow: 0 20px 60px rgba(0,0,0,.5);
      margin-bottom: 20px;
      position: relative;
    }
    .ad-hero::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0;
      height: 3px;
      background: linear-gradient(90deg,#ff6b6b,#feca57,#48dbfb,#ff9ff3,#54a0ff,#5f27cd,#ff6b6b);
      background-size: 300% 100%;
      animation: gradShift 4s linear infinite;
      z-index: 3;
    }
    @keyframes gradShift { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
    .ad-hero-img {
      width: 100%; aspect-ratio: 16 / 9; object-fit: cover;
      background: #05050c; display: block;
    }
    .ad-hero-img-fallback {
      width: 100%; aspect-ratio: 16/9;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg,#0a0a14,#1a1a3e);
      font-size: 3rem; color: rgba(255,255,255,.3);
    }
    .ad-hero video, .ad-hero iframe {
      width: 100%; aspect-ratio: 16/9; object-fit: cover;
      border: 0; display: block;
    }
    .ad-hero-body { padding: 24px 24px 26px; }

    .ad-sponsor-row {
      display: flex; align-items: center; gap: 14px; margin-bottom: 18px;
      text-decoration: none;
      color: inherit;
      transition: transform .25s;
    }
    .ad-sponsor-row:hover { transform: translateY(-2px); }
    .ad-sponsor-logo {
      width: 52px; height: 52px; border-radius: 14px;
      background: linear-gradient(135deg, #ff6000, #ff9f43);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.4rem;
      color: white;
      flex-shrink: 0;
      overflow: hidden;
      box-shadow: 0 6px 20px -6px #ff6000;
      border: 2px solid rgba(255,255,255,.15);
    }
    .ad-sponsor-logo img { width: 100%; height: 100%; object-fit: cover; }
    .ad-sponsor-info { min-width: 0; flex: 1; }
    .ad-sponsor-name {
      font-family: 'Syne', sans-serif; font-weight: 800; font-size: 14px;
      color: white; margin-bottom: 3px;
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    }
    .ad-sponsor-tag {
      display: inline-block;
      background: rgba(10,10,20,.75); color: white;
      font-size: 9px; font-weight: 800;
      padding: 3px 10px; border-radius: 100px;
      text-transform: uppercase; letter-spacing: .7px;
      border: 1px solid rgba(255,255,255,.15);
    }
    .ad-sponsor-cta-hint {
      font-size: 11.5px;
      color: #ff9f43;
      font-weight: 600;
      margin-top: 4px;
    }
    .ad-title-big {
      font-family: 'Syne', sans-serif; font-weight: 800;
      font-size: clamp(1.4rem, 4vw, 2rem);
      color: white; line-height: 1.15; margin-bottom: 12px;
      letter-spacing: -.3px;
    }
    .ad-desc-big {
      font-size: 15px; line-height: 1.65; color: rgba(255,255,255,.65);
      margin-bottom: 20px;
    }
    .ad-cta-big {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      background: linear-gradient(135deg, #ff6000, #ff9f43);
      color: white; font-weight: 800; font-size: 16px;
      padding: 17px 24px; border-radius: 12px;
      text-decoration: none; width: 100%; box-sizing: border-box;
      box-shadow: 0 8px 30px -6px rgba(255,96,0,.5);
      transition: transform .25s, box-shadow .25s;
    }
    .ad-cta-big:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 40px -6px rgba(255,96,0,.7);
    }

    /* Business profile promo strip */
    .business-strip {
      display: flex; align-items: center; gap: 16px;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 16px;
      padding: 16px 18px;
      margin-top: 20px;
      text-decoration: none;
      color: inherit;
      transition: all .25s;
      flex-wrap: wrap;
    }
    .business-strip:hover {
      background: rgba(255,255,255,.07);
      border-color: rgba(255,159,67,.35);
      transform: translateY(-2px);
    }
    .bs-logo {
      width: 48px; height: 48px; border-radius: 12px;
      background: linear-gradient(135deg, #ff6000, #ff9f43);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.2rem;
      color: white; flex-shrink: 0; overflow: hidden;
    }
    .bs-logo img { width: 100%; height: 100%; object-fit: cover; }
    .bs-info { flex: 1; min-width: 180px; }
    .bs-name {
      font-family: 'Syne', sans-serif; font-weight: 700; font-size: 14px;
      color: white; margin-bottom: 3px;
    }
    .bs-tagline {
      font-size: 12.5px; color: rgba(255,255,255,.55);
      line-height: 1.4;
    }
    .bs-arrow {
      color: #ff9f43; font-size: 18px; flex-shrink: 0;
    }

    .ad-report-row { text-align: center; margin-top: 16px; font-size: 12px; color: rgba(255,255,255,.4); }
    .ad-report-row a { color: rgba(255,255,255,.4); text-decoration: underline; cursor: pointer; }

    /* More businesses section */
    .more-section { margin-top: 32px; }
    .more-section h2 {
      font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.15rem;
      color: white; margin-bottom: 6px; letter-spacing: -.2px;
    }
    .more-section p.sub { font-size: 13px; color: rgba(255,255,255,.5); margin-bottom: 16px; }
    .more-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;
    }
    .more-card {
      background: linear-gradient(160deg, #12122a, #0a0a14);
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.08);
      padding: 16px;
      text-decoration: none;
      color: inherit;
      display: flex; align-items: center; gap: 12px;
      transition: all .25s;
    }
    .more-card:hover {
      transform: translateY(-3px);
      border-color: rgba(255,159,67,.35);
      box-shadow: 0 8px 24px rgba(0,0,0,.4);
    }
    .more-card-logo {
      width: 44px; height: 44px; border-radius: 12px;
      background: linear-gradient(135deg, #ff6000, #ff9f43);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.1rem;
      color: white; flex-shrink: 0; overflow: hidden;
    }
    .more-card-logo img { width: 100%; height: 100%; object-fit: cover; }
    .more-card-body { flex: 1; min-width: 0; }
    .more-card-biz {
      font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px;
      color: white; margin-bottom: 2px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .more-card-tag {
      font-size: 11.5px; color: rgba(255,255,255,.5);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    .advertise-strip {
      margin-top: 30px;
      background: linear-gradient(135deg, #12122a, #0a0a14);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 16px;
      padding: 24px 22px;
      display: flex; align-items: center; justify-content: space-between;
      gap: 16px; flex-wrap: wrap;
    }
    .advertise-strip h3 {
      font-family: 'Syne', sans-serif; font-weight: 800;
      font-size: 1.05rem; color: white; margin: 0 0 4px;
    }
    .advertise-strip p { font-size: 13px; color: rgba(255,255,255,.55); margin: 0; line-height: 1.5; }
    .advertise-strip a {
      background: linear-gradient(135deg, #ff6000, #ff9f43);
      color: white; font-weight: 700;
      padding: 10px 18px; border-radius: 10px;
      text-decoration: none; white-space: nowrap; font-size: 13px;
    }

    .empty {
      text-align: center; padding: 80px 20px;
      background: linear-gradient(160deg, #12122a, #0a0a14);
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,.08);
    }
    .empty-icon { font-size: 3rem; margin-bottom: 12px; }
    .empty h1 { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.5rem; margin: 0 0 8px; color: white; }
    .empty p { color: rgba(255,255,255,.5); font-size: 14px; margin: 0 0 20px; }
    .btn-primary {
      display: inline-flex; align-items: center; gap: 8px;
      background: linear-gradient(135deg, #ff6000, #ff9f43);
      color: white; font-weight: 700; font-size: 14px;
      padding: 12px 22px; border-radius: 10px; text-decoration: none;
      box-shadow: 0 4px 16px rgba(255,96,0,.35);
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

    // Impression
    P.visitorHash().then(function (vh) {
      return fetch(P.config.url + '/rest/v1/ad_impressions', {
        method: 'POST',
        headers: { 'apikey': P.config.key, 'Authorization': 'Bearer ' + P.config.key, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ ad_id: AD_ID, visitor_hash: vh, placement: 'share', source: P.detectSource() })
      }).catch(function () {});
    });

    // CTA click
    var cta = document.getElementById('ad-cta');
    if (cta) {
      cta.addEventListener('click', function () {
        P.visitorHash().then(function (vh) {
          return fetch(P.config.url + '/rest/v1/ad_clicks', {
            method: 'POST',
            headers: { 'apikey': P.config.key, 'Authorization': 'Bearer ' + P.config.key, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ ad_id: AD_ID, visitor_hash: vh, placement: 'share', source: P.detectSource() })
          }).catch(function () {});
        });
      });
    }

    // Report link
    var report = document.getElementById('ad-report');
    if (report) {
      report.addEventListener('click', function (e) {
        e.preventDefault();
        var reason = window.prompt('Report this ad.\\n\\nPlease type a short reason:', '');
        if (!reason || !reason.trim()) return;
        P.visitorHash().then(function (vh) {
          return fetch(P.config.url + '/rest/v1/ad_reports', {
            method: 'POST',
            headers: { 'apikey': P.config.key, 'Authorization': 'Bearer ' + P.config.key, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ ad_id: AD_ID, reason: reason.trim().slice(0, 120), visitor_hash: vh })
          });
        }).then(function () { window.alert('Thank you. Our team will review this ad.'); })
          .catch(function () { window.alert('Could not submit report right now.'); });
      });
    }
  })();
</script>
</body>
</html>`;
}

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
  }), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export async function onRequestGet(context) {
  const { params } = context;
  const slug = params && params.slug;
  if (!slug || typeof slug !== 'string') return notFoundPage('');

  let ad;
  try { ad = await fetchAd(slug); } catch (e) { return new Response('Error loading ad', { status: 502 }); }
  if (!ad) return notFoundPage(slug);

  const now = new Date();
  const startOk = !ad.start_date || new Date(ad.start_date) <= now;
  const endOk   = !ad.end_date   || new Date(ad.end_date)   >  now;
  if (ad.status !== 'approved' || !startOk || !endOk) return notFoundPage(slug);

  // Fetch advertiser's profile + other businesses
  let advProfile = null;
  let others = [];
  try { advProfile = await fetchAdvertiserProfile(ad.advertiser_id); } catch (e) {}
  try { others = await fetchOtherBusinesses(ad.advertiser_id); } catch (e) {}

  const biz = (ad.advertisers && ad.advertisers.business_name) || 'Zambian Business';
  const bizLogo = (ad.advertisers && ad.advertisers.logo_url) || '';
  const bizSlug = advProfile ? advProfile.slug : '';
  const bizTagline = advProfile ? (advProfile.tagline || '') : '';
  const isVerified = advProfile && advProfile.verified === true;
  const cta = ctaFor(ad);

  const canonical = SITE_URL + '/ad/' + encodeURIComponent(ad.slug);
  const heroImg = ad.media_url || FALLBACK_OG_IMAGE;
  const ogTitle = ad.title + ' — ' + biz + ' | PhoneYa2 Ads';
  const ogDesc = (ad.description || ('Discover ' + biz + ' on PhoneYa2.')).slice(0, 160);
  const ogImg = heroImg;

  // Hero media — image or video
  let heroHtml;
  const mType = ad.media_type || 'image';
  const mProvider = ad.video_provider || '';
  const mUrl = ad.media_url || '';

  if (!mUrl) {
    heroHtml = '<div class="ad-hero-img-fallback">🇿🇲</div>';
  } else if (mType === 'video') {
    if (mProvider === 'youtube' || /youtube\.com|youtu\.be/i.test(mUrl)) {
      const m = mUrl.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
      heroHtml = m
        ? '<iframe src="https://www.youtube.com/embed/' + esc(m[1]) + '?autoplay=1&mute=1&loop=1&playlist=' + esc(m[1]) + '&controls=0&modestbranding=1&rel=0&playsinline=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen title="' + esc(ad.title) + '"></iframe>'
        : '<div class="ad-hero-img-fallback">▶</div>';
    } else if (mProvider === 'vimeo' || /vimeo\.com/i.test(mUrl)) {
      const m = mUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      heroHtml = m
        ? '<iframe src="https://player.vimeo.com/video/' + esc(m[1]) + '?autoplay=1&muted=1&loop=1&background=1" frameborder="0" allow="autoplay" allowfullscreen title="' + esc(ad.title) + '"></iframe>'
        : '<div class="ad-hero-img-fallback">▶</div>';
    } else if (mProvider === 'tiktok' || /tiktok\.com/i.test(mUrl)) {
      heroHtml = '<div class="ad-hero-img-fallback" style="background:linear-gradient(135deg,#000,#fe2c55);color:white">🎵</div>';
    } else {
      heroHtml = '<video src="' + esc(mUrl) + '" autoplay muted loop playsinline></video>';
    }
  } else {
    heroHtml = '<img class="ad-hero-img" src="' + esc(mUrl) + '" alt="' + esc(ad.title) + '" onerror="this.outerHTML=\'<div class=\\'ad-hero-img-fallback\\'>🖼️</div>\'">';
  }

  // Business logo
  const logoHtml = bizLogo
    ? '<img src="' + esc(bizLogo) + '" alt="" onerror="this.parentElement.textContent=\'' + esc(biz.charAt(0).toUpperCase()) + '\'">'
    : esc(biz.charAt(0).toUpperCase());

  // Profile strip
  const profileStripHtml = bizSlug
    ? '<a class="business-strip" href="/b/' + esc(bizSlug) + '">' +
        '<div class="bs-logo">' + logoHtml + '</div>' +
        '<div class="bs-info">' +
          '<div class="bs-name">' + esc(biz) + (isVerified ? ' <span style="color:#48dbfb;font-size:12px;">✓</span>' : '') + '</div>' +
          '<div class="bs-tagline">' + (bizTagline ? esc(bizTagline) : 'Visit their full profile') + '</div>' +
        '</div>' +
        '<i class="fa-solid fa-arrow-right bs-arrow"></i>' +
      '</a>'
    : '';

  // Other businesses
  const moreHtml = others.length
    ? '<div class="more-section">' +
        '<h2>🇿🇲 Discover other Zambian businesses</h2>' +
        '<p class="sub">More businesses on PhoneYa2</p>' +
        '<div class="more-grid">' +
          others.map(o => {
            const oBiz = (o.advertisers && o.advertisers.business_name) || 'Business';
            const oLogo = o.logo_url
              ? '<img src="' + esc(o.logo_url) + '" alt="" onerror="this.parentElement.textContent=\'' + esc(oBiz.charAt(0).toUpperCase()) + '\'">'
              : esc(oBiz.charAt(0).toUpperCase());
            const oTag = o.tagline || 'Visit profile';
            const oVerified = o.verified === true ? ' <span style="color:#48dbfb;font-size:11px;">✓</span>' : '';
            return '<a class="more-card" href="/b/' + esc(o.slug) + '">' +
              '<div class="more-card-logo">' + oLogo + '</div>' +
              '<div class="more-card-body">' +
                '<div class="more-card-biz">' + esc(oBiz) + oVerified + '</div>' +
                '<div class="more-card-tag">' + esc(oTag) + '</div>' +
              '</div>' +
            '</a>';
          }).join('') +
        '</div>' +
      '</div>'
    : '';

  const iconPrefix = cta.isBrand ? 'brands' : 'solid';

  const bodyHtml = `
    <div class="wrap">
      <div class="topbar-mini">
        <a class="brand-link" href="/">
          <span style="font-size:22px;">📱</span>
          <div>PhoneYa2 <span>Ads</span></div>
        </a>
        <a href="/shop.html" style="font-size:13px;color:#ff9f43;font-weight:600;text-decoration:none;">
          Shop accessories <i class="fa-solid fa-arrow-right"></i>
        </a>
      </div>

      <div class="ad-hero">
        ${heroHtml}
        <div class="ad-hero-body">
          <a class="ad-sponsor-row" href="${bizSlug ? '/b/' + esc(bizSlug) : '#'}">
            <div class="ad-sponsor-logo">${logoHtml}</div>
            <div class="ad-sponsor-info">
              <div class="ad-sponsor-name">
                ${esc(biz)}
                ${isVerified ? '<span style="color:#48dbfb;font-size:13px;">✓</span>' : ''}
                <span class="ad-sponsor-tag">Sponsored</span>
              </div>
              ${bizSlug ? '<div class="ad-sponsor-cta-hint">Tap to view full profile <i class="fa-solid fa-arrow-right" style="font-size:10px;"></i></div>' : ''}
            </div>
          </a>

          <h1 class="ad-title-big">${esc(ad.title)}</h1>
          ${ad.description ? `<p class="ad-desc-big">${esc(ad.description)}</p>` : ''}

          <a id="ad-cta" class="ad-cta-big" href="${esc(cta.href)}" target="_blank" rel="noopener">
            <i class="fa-${iconPrefix} fa-${cta.icon}"></i>
            ${esc(cta.label)}
          </a>

          ${profileStripHtml}

          <div class="ad-report-row">
            <a id="ad-report" href="#">Report this ad</a>
          </div>
        </div>
      </div>

      ${moreHtml}

      <div class="advertise-strip">
        <div>
          <h3>Want your business here?</h3>
          <p>Advertise on PhoneYa2 and get a free business profile. Upgrade anytime for custom branding.</p>
        </div>
        <a href="/advertise/">Get started →</a>
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
