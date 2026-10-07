/* ═══════════════════════════════════════════════════════════════════════════
   Cloudflare Pages Function — GET /b/:slug
   ────────────────────────────────────────────────────────────────────────
   Renders the public business profile (the "mini-website") with OG tags
   prerendered for WhatsApp / Facebook / Twitter / LinkedIn previews.

   Route: /b/:slug
   Cloudflare Pages auto-routes /b/anything-here to this file.

   Data sources:
     · advertiser_profiles  — branding + contact info
     · advertisers          — business name, logo, tier, status
     · ads                  — approved ads to list
     · profiles (via RPC)   — profile view counter

   Records a profile view via record_profile_view() RPC on every hit.
   ═══════════════════════════════════════════════════════════════════════════ */

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

function safeColor(c, fallback) {
  if (!c || typeof c !== 'string') return fallback;
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback;
}

// Slightly darker version of a hex color, for gradients / contrast
function darken(hex, amount) {
  const c = safeColor(hex, '#ff6000');
  const num = parseInt(c.slice(1), 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8)  & 0xff;
  let b = num         & 0xff;
  r = Math.max(0, Math.round(r * (1 - amount)));
  g = Math.max(0, Math.round(g * (1 - amount)));
  b = Math.max(0, Math.round(b * (1 - amount)));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function ytId(url) {
  const m = String(url).match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
function vimeoId(url) {
  const m = String(url).match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

function ctaLabelShort(t) {
  if (t === 'whatsapp')  return 'Chat on WhatsApp';
  if (t === 'website')   return 'Visit Website';
  if (t === 'facebook')  return 'View on Facebook';
  if (t === 'instagram') return 'View on Instagram';
  if (t === 'tiktok')    return 'View on TikTok';
  if (t === 'youtube')   return 'Watch on YouTube';
  return 'View';
}

function ctaIcon(t) {
  if (t === 'whatsapp')  return 'fa-brands fa-whatsapp';
  if (t === 'website')   return 'fa-solid fa-globe';
  if (t === 'facebook')  return 'fa-brands fa-facebook-f';
  if (t === 'instagram') return 'fa-brands fa-instagram';
  if (t === 'tiktok')    return 'fa-brands fa-tiktok';
  if (t === 'youtube')   return 'fa-brands fa-youtube';
  return 'fa-solid fa-arrow-up-right-from-square';
}

function ctaHref(ad) {
  const t = ad.destination_type;
  const u = ad.destination_url || '';
  if (t === 'whatsapp') {
    const digits = String(u).replace(/[^\d]/g, '');
    return 'https://wa.me/' + digits;
  }
  return u;
}

const TIER_LABEL = {
  free:     'Free',
  starter:  'Starter',
  standard: 'Standard',
  business: 'Business',
  premium:  'Premium'
};
const TIER_RANK = { free: 0, starter: 1, standard: 2, business: 3, premium: 4 };

// ── Fetch the profile ─────────────────────────────────────────────────────
async function fetchProfile(slug) {
  const qs =
    'advertiser_profiles?select=id,advertiser_id,slug,tagline,about,primary_color,accent_color,cover_image_url,social_links,contact_phone,contact_whatsapp,contact_email,verified,view_count,advertisers(business_name,logo_url,tier,tier_expires_at,status)' +
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

// ── Fetch approved ads for this advertiser ────────────────────────────────
async function fetchAds(advertiserId) {
  const now = new Date().toISOString();
  const qs =
    'ads?select=id,slug,title,description,media_url,media_type,video_provider,destination_type,destination_url,weight,status,start_date,end_date,created_at' +
    '&advertiser_id=eq.' + encodeURIComponent(advertiserId) +
    '&status=eq.approved' +
    '&start_date=lte.' + encodeURIComponent(now) +
    '&or=(end_date.is.null,end_date.gt.' + encodeURIComponent(now) + ')' +
    '&order=weight.desc,created_at.desc' +
    '&limit=50';

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

// ── Fetch other businesses (for cross-promotion) ──────────────────────────
async function fetchOtherBusinesses(excludeAdvertiserId, limit) {
  limit = limit || 4;
  // Fetch advertiser_profiles that have a verified flag or are on a paid tier
  // and are not this one. Order by view_count desc, so popular ones show first.
  const qs =
    'advertiser_profiles?select=id,advertiser_id,slug,tagline,logo_url:advertisers(logo_url),advertisers(business_name,logo_url,tier,tier_expires_at,status)' +
    '&advertiser_id=neq.' + encodeURIComponent(excludeAdvertiserId) +
    '&limit=' + limit;

  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + qs, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Accept': 'application/json'
      }
    });
    if (!r.ok) return [];
    const rows = await r.json();
    if (!Array.isArray(rows)) return [];
    // Filter out banned and expired, and only show ones with a business_name
    return rows.filter(function (row) {
      const adv = row.advertisers || {};
      if (adv.status === 'banned') return false;
      if (!adv.business_name) return false;
      return true;
    });
  } catch (e) {
    return [];
  }
}

// ── Record a view (fire-and-forget) ───────────────────────────────────────
async function recordView(slug, source) {
  try {
    await fetch(SUPABASE_URL + '/rest/v1/rpc/record_profile_view', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_slug:    slug,
        p_visitor: null,
        p_source:  source || 'direct'
      })
    });
  } catch (e) { /* silent */ }
}

function detectSource(referer) {
  if (!referer) return 'direct';
  if (/whatsapp|wa\.me/i.test(referer))  return 'whatsapp';
  if (/facebook|fb\.com/i.test(referer)) return 'facebook';
  if (/instagram/i.test(referer))        return 'instagram';
  return 'other';
}

// ── Render one ad card ────────────────────────────────────────────────────
function renderAdCard(ad) {
  const mediaType = ad.media_type || 'image';
  const provider  = ad.video_provider || '';
  const url       = ad.media_url || '';
  let mediaHtml;

  if (!url) {
    mediaHtml = '<div class="ad-media-ph">🇿🇲</div>';
  } else if (mediaType === 'video') {
    if (provider === 'youtube' || /youtube\.com|youtu\.be/i.test(url)) {
      const vid = ytId(url);
      mediaHtml = vid
        ? '<iframe src="https://www.youtube.com/embed/' + esc(vid) + '?autoplay=1&mute=1&loop=1&playlist=' + esc(vid) + '&controls=0&modestbranding=1&rel=0&playsinline=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen loading="lazy"></iframe>'
        : '<div class="ad-media-ph">▶</div>';
    } else if (provider === 'vimeo' || /vimeo\.com/i.test(url)) {
      const vid = vimeoId(url);
      mediaHtml = vid
        ? '<iframe src="https://player.vimeo.com/video/' + esc(vid) + '?autoplay=1&muted=1&loop=1&background=1" frameborder="0" allow="autoplay" allowfullscreen loading="lazy"></iframe>'
        : '<div class="ad-media-ph">▶</div>';
    } else if (provider === 'tiktok' || /tiktok\.com/i.test(url)) {
      mediaHtml = '<div class="ad-media-ph" style="background:linear-gradient(135deg,#000,#fe2c55);color:white">🎵</div>';
    } else {
      mediaHtml = '<video src="' + esc(url) + '" autoplay muted loop playsinline></video>';
    }
  } else {
    mediaHtml = '<img src="' + esc(url) + '" alt="' + esc(ad.title) + '" loading="lazy">';
  }

  const ctaHrefVal = ctaHref(ad);
  const ctaLabel   = ctaLabelShort(ad.destination_type);
  const ctaIconCls = ctaIcon(ad.destination_type);

  return `
    <article class="ad-card" data-ad-id="${esc(ad.id)}">
      <div class="ad-media">${mediaHtml}</div>
      <div class="ad-body">
        <h3 class="ad-title">${esc(ad.title || '')}</h3>
        ${ad.description ? `<p class="ad-desc">${esc(ad.description)}</p>` : ''}
        <a class="ad-cta" href="${esc(ctaHrefVal)}" target="_blank" rel="noopener">
          <span><i class="${ctaIconCls}"></i> ${esc(ctaLabel)}</span>
          <span class="arrow"><i class="fa-solid fa-arrow-right"></i></span>
        </a>
      </div>
    </article>
  `;
}

// ── 404 page ──────────────────────────────────────────────────────────────
function notFoundPage(slug) {
  const body = `
    <div class="wrap">
      <div class="empty">
        <div class="empty-icon">🔍</div>
        <h1>Business not found</h1>
        <p>We couldn't find a business with that address.</p>
        <a class="btn-primary" href="/">Browse PhoneYa2 <i class="fa-solid fa-arrow-right"></i></a>
      </div>
    </div>
  `;
  return new Response(renderShell({
    title: 'Business not found — PhoneYa2',
    description: 'This business profile does not exist.',
    ogImage: FALLBACK_OG_IMAGE,
    canonicalUrl: SITE_URL + '/b/' + encodeURIComponent(slug || ''),
    bodyHtml: body,
    primaryColor: '#ff6000',
    accentColor: '#ff9f43',
    isProfile: false
  }), {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}

// ── Full HTML shell ───────────────────────────────────────────────────────
function renderShell({ title, description, ogImage, canonicalUrl, bodyHtml, primaryColor, accentColor, isProfile }) {
  const p = safeColor(primaryColor, '#ff6000');
  const a = safeColor(accentColor,  '#ff9f43');
  const pDark = darken(p, 0.15);
  const pDarker = darken(p, 0.35);

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
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="theme-color" content="${esc(p)}">
  <meta name="robots" content="index,follow">

  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="PhoneYa2 Ads">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <meta property="og:url" content="${esc(canonicalUrl)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(ogImage)}">

  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="/ads-shared.css">
  <style>
    :root {
      --brand: ${esc(p)};
      --brand-dark: ${esc(pDark)};
      --brand-darker: ${esc(pDarker)};
      --brand-2: ${esc(a)};
      --ink: #e8e8f0;
      --ink-soft: rgba(255,255,255,.62);
      --ink-mute: rgba(255,255,255,.42);
      --surface: #0a0a14;
      --surface-2: #12122a;
      --surface-3: #1a1a3e;
      --card-border: rgba(255,255,255,.08);
      --card-border-strong: rgba(255,255,255,.14);
    }

    *, *::before, *::after { box-sizing: border-box; }

    body {
      background: var(--surface);
      font-family: 'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
      color: var(--ink);
      margin: 0;
      padding-bottom: 60px;
      -webkit-font-smoothing: antialiased;
      line-height: 1.55;
    }
    h1, h2, h3, h4 { font-family: 'Syne', system-ui, sans-serif; margin: 0; line-height: 1.15; }
    a { color: inherit; }
    img { max-width: 100%; display: block; }

    .wrap {
      max-width: 980px;
      margin: 0 auto;
      padding: 20px 16px 40px;
    }
    @media (min-width: 640px) { .wrap { padding: 28px 24px 60px; } }

    /* ── Top bar ─────────────────────────────────────────────────── */
    .topbar-mini {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 0 18px; flex-wrap: wrap; gap: 10px;
    }
    .brand-link {
      display: flex; align-items: center; gap: 8px;
      font-family: 'Syne', system-ui, sans-serif; font-weight: 800; font-size: 15px;
      text-decoration: none; color: white;
    }
    .brand-link .brand-mark {
      width: 32px; height: 32px;
      border-radius: 9px;
      background: linear-gradient(135deg, var(--brand), var(--brand-2));
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
      box-shadow: 0 4px 14px -4px var(--brand);
    }
    .brand-link .brand-text { line-height: 1; }
    .brand-link .brand-text small {
      display: block;
      font-size: 9px; font-weight: 700;
      letter-spacing: 1.4px; text-transform: uppercase;
      color: var(--ink-mute);
      margin-top: 2px;
    }
    .brand-link .brand-text b { font-weight: 800; }
    .brand-link .brand-text b span { color: var(--brand); }
    .topbar-mini a.shop-link {
      font-size: 13px; font-weight: 700;
      color: white;
      text-decoration: none;
      padding: 8px 16px; border-radius: 100px;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.1);
      transition: all .25s;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .topbar-mini a.shop-link:hover {
      background: rgba(255,255,255,.12);
      border-color: var(--brand);
      transform: translateY(-1px);
    }

    /* ── Cover ───────────────────────────────────────────────────── */
    .cover {
      position: relative;
      width: 100%;
      aspect-ratio: 3/1;
      border-radius: 20px;
      overflow: hidden;
      background: linear-gradient(135deg, var(--brand-darker), var(--brand), var(--brand-2));
      margin-bottom: -60px;
      box-shadow: 0 20px 60px rgba(0,0,0,.55);
    }
    .cover::after {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(to bottom, transparent 35%, rgba(10,10,20,.95));
      pointer-events: none;
    }
    .cover.no-image {
      /* Animated gradient cover for advertisers without a cover image */
      background: linear-gradient(135deg, var(--brand-darker) 0%, var(--brand) 40%, var(--brand-2) 100%);
      background-size: 200% 200%;
      animation: coverShift 12s ease-in-out infinite;
    }
    @keyframes coverShift {
      0%, 100% { background-position: 0% 0%; }
      50%      { background-position: 100% 100%; }
    }
    .cover img { width: 100%; height: 100%; object-fit: cover; display: block; }

    /* ── Profile card ────────────────────────────────────────────── */
    .profile-card {
      position: relative;
      background: linear-gradient(160deg, var(--surface-2) 0%, var(--surface) 100%);
      border-radius: 20px;
      border: 1px solid var(--card-border);
      padding: 24px;
      margin-bottom: 28px;
      box-shadow: 0 12px 40px rgba(0,0,0,.45);
      z-index: 2;
    }
    @media (max-width: 600px) { .profile-card { padding: 18px; } }

    .profile-head {
      display: flex; align-items: flex-start; gap: 20px;
      margin-bottom: 18px; flex-wrap: wrap;
    }
    @media (max-width: 600px) { .profile-head { gap: 14px; } }

    .logo-box {
      width: 96px; height: 96px;
      border-radius: 22px;
      background: linear-gradient(135deg, var(--brand), var(--brand-2));
      display: flex; align-items: center; justify-content: center;
      font-size: 2.4rem; font-weight: 800; color: white;
      font-family: 'Syne', sans-serif;
      flex-shrink: 0;
      overflow: hidden;
      box-shadow: 0 12px 34px -8px var(--brand), 0 0 0 3px rgba(255,255,255,.08) inset;
      border: 2px solid rgba(255,255,255,.12);
    }
    @media (max-width: 600px) { .logo-box { width: 76px; height: 76px; font-size: 1.9rem; border-radius: 18px; } }
    .logo-box img { width: 100%; height: 100%; object-fit: cover; }

    .profile-info { flex: 1; min-width: 200px; }

    .profile-name {
      font-family: 'Syne', sans-serif;
      font-weight: 800;
      font-size: clamp(1.5rem, 4vw, 2.15rem);
      color: white;
      margin: 0 0 8px;
      line-height: 1.08;
      letter-spacing: -.5px;
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    }

    .tier-badge {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 10px; font-weight: 800;
      padding: 4px 11px; border-radius: 100px;
      letter-spacing: .8px; text-transform: uppercase;
      white-space: nowrap;
    }
    .tier-badge.free     { background: rgba(107,114,128,.18); color: #9ca3af; border: 1px solid rgba(107,114,128,.3); }
    .tier-badge.starter  { background: rgba(37,99,235,.2);   color: #93c5fd; border: 1px solid rgba(37,99,235,.35); }
    .tier-badge.standard { background: rgba(124,58,237,.2);  color: #c4b5fd; border: 1px solid rgba(124,58,237,.35); }
    .tier-badge.business { background: rgba(217,119,6,.22);  color: #fcd34d; border: 1px solid rgba(217,119,6,.4); }
    .tier-badge.premium  { background: linear-gradient(135deg, var(--brand), var(--brand-2)); color: white; box-shadow: 0 4px 14px -4px var(--brand); }

    .verified-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: linear-gradient(135deg, #5f27cd, #54a0ff);
      color: white;
      font-size: 10.5px; font-weight: 800;
      padding: 4px 12px; border-radius: 100px;
      letter-spacing: .8px; text-transform: uppercase;
      box-shadow: 0 4px 14px rgba(84,160,255,.4);
    }

    .profile-tagline {
      font-size: 15px;
      color: var(--ink-soft);
      line-height: 1.6;
      margin: 0;
      max-width: 60ch;
    }

    /* ── Contact & social ────────────────────────────────────────── */
    .contact-row {
      display: flex; flex-wrap: wrap; gap: 10px;
      margin-top: 6px;
    }
    .contact-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 11px 20px;
      border-radius: 100px;
      font-size: 13px; font-weight: 700;
      text-decoration: none;
      transition: all .25s;
      border: 1px solid rgba(255,255,255,.1);
      background: rgba(255,255,255,.05);
      color: white;
      min-height: 44px;
    }
    .contact-btn:hover {
      transform: translateY(-2px);
      background: rgba(255,255,255,.1);
    }
    .contact-btn.primary {
      background: linear-gradient(135deg, var(--brand), var(--brand-2));
      border: none;
      box-shadow: 0 8px 24px -6px var(--brand);
    }
    .contact-btn.primary:hover {
      box-shadow: 0 14px 32px -6px var(--brand);
    }
    .contact-btn i { font-size: 14px; }

    .social-row {
      display: flex; flex-wrap: wrap; gap: 10px;
      margin-top: 16px;
    }
    .social-pill {
      display: inline-flex; align-items: center; justify-content: center;
      width: 44px; height: 44px;
      border-radius: 12px;
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.1);
      color: rgba(255,255,255,.75);
      font-size: 16px;
      text-decoration: none;
      transition: all .25s;
    }
    .social-pill:hover {
      background: var(--brand);
      color: white;
      transform: translateY(-3px);
      border-color: transparent;
      box-shadow: 0 8px 24px -6px var(--brand);
    }

    /* ── About ───────────────────────────────────────────────────── */
    .about-block {
      background: rgba(255,255,255,.03);
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,.06);
      padding: 20px 22px;
      margin-top: 20px;
    }
    .about-block h2 {
      font-family: 'Syne', sans-serif;
      font-weight: 700;
      font-size: 12px;
      color: var(--ink-mute);
      text-transform: uppercase;
      letter-spacing: 1.4px;
      margin: 0 0 12px;
    }
    .about-block p {
      font-size: 15px;
      line-height: 1.75;
      color: rgba(255,255,255,.82);
      margin: 0;
      white-space: pre-wrap;
    }

    /* ── Ads section ─────────────────────────────────────────────── */
    .ads-section { margin-top: 36px; }
    .ads-section h2 {
      font-family: 'Syne', sans-serif;
      font-weight: 800;
      font-size: 1.3rem;
      color: white;
      margin: 0 0 4px;
      letter-spacing: -.3px;
    }
    .ads-section .sub {
      font-size: 13px;
      color: var(--ink-mute);
      margin: 0 0 20px;
    }
    .ads-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 18px;
    }
    @media (max-width: 600px) { .ads-grid { grid-template-columns: 1fr; gap: 14px; } }

    .ad-card {
      background: linear-gradient(160deg, var(--surface-2) 0%, var(--surface) 100%);
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid var(--card-border);
      transition: transform .35s cubic-bezier(.2,.8,.2,1), box-shadow .35s;
      display: flex; flex-direction: column;
    }
    .ad-card:hover {
      transform: translateY(-6px);
      box-shadow: 0 20px 50px rgba(0,0,0,.5), 0 0 40px -14px var(--brand);
      border-color: var(--card-border-strong);
    }
    .ad-media {
      aspect-ratio: 16/9;
      overflow: hidden;
      background: #05050c;
    }
    .ad-media img,
    .ad-media video,
    .ad-media iframe {
      width: 100%; height: 100%; object-fit: cover; border: 0; display: block;
    }
    .ad-media-ph {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #0a0a14, #1a1a3e);
      color: rgba(255,255,255,.3);
      font-size: 2.2rem;
    }
    .ad-body { padding: 16px 18px 18px; flex: 1; display: flex; flex-direction: column; }
    .ad-title {
      font-family: 'Syne', sans-serif;
      font-weight: 700;
      font-size: 15px;
      color: white;
      margin: 0 0 6px;
      line-height: 1.3;
    }
    .ad-desc {
      font-size: 13px;
      color: rgba(255,255,255,.55);
      line-height: 1.5;
      margin: 0 0 14px;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .ad-cta {
      margin-top: auto;
      display: flex; align-items: center; justify-content: space-between;
      gap: 10px;
      padding: 11px 16px;
      border-radius: 100px;
      font-size: 12.5px; font-weight: 800;
      color: white;
      background: linear-gradient(135deg, var(--brand), var(--brand-2));
      text-decoration: none;
      transition: transform .25s, box-shadow .25s;
      box-shadow: 0 6px 20px -6px var(--brand);
    }
    .ad-cta:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 28px -6px var(--brand);
    }
    .ad-cta .arrow {
      width: 22px; height: 22px;
      border-radius: 50%;
      background: rgba(0,0,0,.22);
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 10px;
      transition: transform .25s;
    }
    .ad-cta:hover .arrow { transform: translateX(3px); }

    /* ── Empty ads state ─────────────────────────────────────────── */
    .no-ads {
      text-align: center;
      padding: 40px 20px;
      color: rgba(255,255,255,.4);
      font-size: 14px;
      background: rgba(255,255,255,.03);
      border-radius: 16px;
      border: 1px dashed rgba(255,255,255,.1);
    }

    /* ── Other businesses ────────────────────────────────────────── */
    .others-section { margin-top: 36px; }
    .others-section h2 {
      font-family: 'Syne', sans-serif;
      font-weight: 800;
      font-size: 1.1rem;
      color: white;
      margin: 0 0 4px;
    }
    .others-section .sub {
      font-size: 13px;
      color: var(--ink-mute);
      margin: 0 0 16px;
    }
    .others-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
    }
    @media (max-width: 600px) { .others-grid { grid-template-columns: 1fr; } }

    .other-card {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px;
      background: linear-gradient(160deg, var(--surface-2) 0%, var(--surface) 100%);
      border-radius: 14px;
      border: 1px solid var(--card-border);
      text-decoration: none;
      color: inherit;
      transition: all .25s;
    }
    .other-card:hover {
      transform: translateY(-2px);
      border-color: rgba(255,159,67,.35);
      box-shadow: 0 8px 24px rgba(0,0,0,.35);
    }
    .other-card .other-logo {
      width: 44px; height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--brand), var(--brand-2));
      display: flex; align-items: center; justify-content: center;
      color: white; font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.1rem;
      flex-shrink: 0;
      overflow: hidden;
    }
    .other-card .other-logo img { width: 100%; height: 100%; object-fit: cover; }
    .other-card .other-body { flex: 1; min-width: 0; }
    .other-card .other-name {
      font-family: 'Syne', sans-serif;
      font-weight: 700;
      font-size: 13.5px;
      color: white;
      margin-bottom: 2px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .other-card .other-tag {
      font-size: 12px;
      color: var(--ink-mute);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .other-card .other-arrow {
      color: var(--brand);
      font-size: 14px;
      flex-shrink: 0;
    }

    /* ── Not-found state ─────────────────────────────────────────── */
    .empty {
      text-align: center;
      padding: 80px 20px;
      background: linear-gradient(160deg, var(--surface-2) 0%, var(--surface) 100%);
      border-radius: 20px;
      border: 1px solid var(--card-border);
    }
    .empty-icon { font-size: 3rem; margin-bottom: 12px; }
    .empty h1 {
      font-family: 'Syne', sans-serif;
      font-weight: 800;
      font-size: 1.5rem;
      margin: 0 0 8px;
      color: white;
    }
    .empty p { color: var(--ink-mute); font-size: 14px; margin: 0 0 20px; }
    .btn-primary {
      display: inline-flex; align-items: center; gap: 8px;
      background: linear-gradient(135deg, #ff6000, #ff9f43);
      color: white; font-weight: 700; font-size: 14px;
      padding: 12px 22px; border-radius: 10px;
      text-decoration: none;
      box-shadow: 0 4px 16px rgba(255,96,0,.35);
    }

    /* ── Advertise strip (bottom CTA) ────────────────────────────── */
    .advertise-strip {
      margin-top: 36px;
      background: linear-gradient(135deg, var(--surface-2), var(--surface));
      border-radius: 16px;
      border: 1px solid var(--card-border);
      padding: 24px 22px;
      display: flex; align-items: center; justify-content: space-between;
      gap: 16px; flex-wrap: wrap;
    }
    .advertise-strip h3 {
      font-family: 'Syne', sans-serif;
      font-weight: 800;
      font-size: 1.05rem;
      color: white;
      margin: 0 0 4px;
    }
    .advertise-strip p {
      font-size: 13px;
      color: var(--ink-mute);
      margin: 0; line-height: 1.5;
    }
    .advertise-strip a {
      background: linear-gradient(135deg, #ff6000, #ff9f43);
      color: white; font-weight: 700;
      padding: 11px 20px; border-radius: 10px;
      text-decoration: none; white-space: nowrap;
      font-size: 13px;
      display: inline-flex; align-items: center; gap: 6px;
      box-shadow: 0 6px 20px -6px #ff6000;
      transition: transform .2s;
    }
    .advertise-strip a:hover { transform: translateY(-2px); }

    /* Mobile tweaks */
    @media (max-width: 600px) {
      .cover { aspect-ratio: 2.2/1; border-radius: 16px; margin-bottom: -40px; }
      .contact-btn { padding: 10px 16px; font-size: 12.5px; }
      .social-pill { width: 40px; height: 40px; font-size: 15px; }
      .advertise-strip { padding: 18px 16px; }
      .advertise-strip a { width: 100%; justify-content: center; }
    }
  </style>
</head>
<body>
${bodyHtml}
<script src="/ads-config.js"></script>
<script>
  // ── Client-side view recording ──────────────────────────────────────
  // Fires once per page load. Uses visitor_hash if ads-config.js is loaded,
  // otherwise falls back to a session-level random ID.
  (function () {
    var P = window.py2Ads;
    var slug = window.__PY2_PROFILE_SLUG__;
    if (!slug || !P) return;
    P.visitorHash().then(function (vh) {
      return fetch(P.config.url + '/rest/v1/rpc/record_profile_view', {
        method: 'POST',
        headers: {
          'apikey':        P.config.key,
          'Authorization': 'Bearer ' + P.config.key,
          'Content-Type':  'application/json'
        },
        body: JSON.stringify({
          p_slug:    slug,
          p_visitor: vh,
          p_source:  P.detectSource()
        })
      });
    }).catch(function () {});
  })();
</script>
</body>
</html>`;
}

// ── Main handler ──────────────────────────────────────────────────────────
export async function onRequestGet(context) {
  const { params, request } = context;
  const slug = params && params.slug;

  if (!slug || typeof slug !== 'string') {
    return notFoundPage('');
  }

  // Fetch profile
  let profile;
  try {
    profile = await fetchProfile(slug);
  } catch (e) {
    return new Response('Error loading profile', { status: 502 });
  }

  if (!profile) return notFoundPage(slug);

  // Block banned advertisers
  const adv = profile.advertisers || {};
  if (adv.status === 'banned') return notFoundPage(slug);

  // Fetch this advertiser's approved ads
  let ads = [];
  try {
    ads = await fetchAds(profile.advertiser_id);
  } catch (e) { /* silent */ }

  // Fetch other businesses for cross-promotion
  let others = [];
  try {
    others = await fetchOtherBusinesses(profile.advertiser_id, 4);
  } catch (e) { /* silent */ }

  // Effective tier (paid expired → treat as free for display)
  const rawTier = adv.tier || 'free';
  const expiresAt = adv.tier_expires_at ? new Date(adv.tier_expires_at) : null;
  const expired = expiresAt && expiresAt < new Date();
  const effectiveTier = (rawTier === 'free' || expired) ? 'free' : rawTier;
  const rank = TIER_RANK[effectiveTier] || 0;

  // Feature entitlements by tier
  const canCustomize = rank >= 2; // Standard+
  const canBeVerified = rank >= 3; // Business+
  const verified = profile.verified === true && canBeVerified;

  // Brand colors — only applied if Standard+
  const primaryColor = canCustomize ? safeColor(profile.primary_color, '#ff6000') : '#ff6000';
  const accentColor  = canCustomize ? safeColor(profile.accent_color,  '#ff9f43') : '#ff9f43';

  // Business identity
  const bizName = adv.business_name || 'Zambian Business';
  const logo    = adv.logo_url || null;   // logo available from Starter+
  const cover   = canCustomize ? profile.cover_image_url : null;
  const tagline = profile.tagline || '';
  const about   = profile.about   || '';

  // Social links — Standard+
  const socials = canCustomize && profile.social_links && typeof profile.social_links === 'object'
    ? profile.social_links
    : {};
  const socialLinks = [
    { key: 'facebook',  icon: 'fa-brands fa-facebook-f', label: 'Facebook'  },
    { key: 'instagram', icon: 'fa-brands fa-instagram',  label: 'Instagram' },
    { key: 'tiktok',    icon: 'fa-brands fa-tiktok',     label: 'TikTok'    },
    { key: 'youtube',   icon: 'fa-brands fa-youtube',    label: 'YouTube'   },
    { key: 'website',   icon: 'fa-solid fa-globe',       label: 'Website'   }
  ].filter(s => socials[s.key]);

  // Contact info
  const phone    = profile.contact_phone    || null;
  const whatsapp = profile.contact_whatsapp || null;
  const email    = profile.contact_email    || null;
  const waDigits = whatsapp ? String(whatsapp).replace(/[^\d]/g, '') : null;

  // ── Build the profile HTML ────────────────────────────────────────

  const logoHtml = logo
    ? `<img src="${esc(logo)}" alt="${esc(bizName)}" onerror="this.parentElement.textContent='${esc(bizName.charAt(0))}'">`
    : esc(bizName.charAt(0).toUpperCase());

  const coverHtml = cover
    ? `<div class="cover"><img src="${esc(cover)}" alt="" onerror="this.parentElement.classList.add('no-image');this.remove();"></div>`
    : `<div class="cover no-image"></div>`;

  const tierBadgeHtml = effectiveTier !== 'free'
    ? `<span class="tier-badge ${effectiveTier}">${esc(TIER_LABEL[effectiveTier] || effectiveTier)}</span>`
    : '';

  const verifiedBadge = verified
    ? `<span class="verified-badge"><i class="fa-solid fa-circle-check"></i> Verified</span>`
    : '';

  const contactButtons = [];
  if (whatsapp && waDigits) {
    contactButtons.push(`<a class="contact-btn primary" href="https://wa.me/${esc(waDigits)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>`);
  }
  if (phone) {
    contactButtons.push(`<a class="contact-btn" href="tel:${esc(phone)}"><i class="fa-solid fa-phone"></i> Call</a>`);
  }
  if (email) {
    contactButtons.push(`<a class="contact-btn" href="mailto:${esc(email)}"><i class="fa-solid fa-envelope"></i> Email</a>`);
  }

  const socialsHtml = socialLinks.length
    ? `<div class="social-row">${socialLinks.map(s =>
        `<a class="social-pill" href="${esc(socials[s.key])}" target="_blank" rel="noopener" aria-label="${esc(s.label)}"><i class="${s.icon}"></i></a>`
      ).join('')}</div>`
    : '';

  const aboutHtml = about
    ? `<div class="about-block"><h2>About</h2><p>${esc(about)}</p></div>`
    : '';

  const adsHtml = ads.length
    ? `<section class="ads-section">
        <h2>Their Ads on PhoneYa2</h2>
        <p class="sub">${ads.length} live ad${ads.length !== 1 ? 's' : ''} by ${esc(bizName)}</p>
        <div class="ads-grid">${ads.map(renderAdCard).join('')}</div>
      </section>`
    : `<section class="ads-section">
        <h2>Their Ads on PhoneYa2</h2>
        <p class="sub">No live ads right now</p>
        <div class="no-ads">This business has no approved ads at the moment. Check back soon.</div>
      </section>`;

  // Cross-promotion: other businesses on PhoneYa2
  let othersHtml = '';
  if (others.length) {
    const cards = others.map(function (o) {
      const oAdv  = o.advertisers || {};
      const oName = oAdv.business_name || 'Business';
      const oTag  = o.tagline || 'Visit profile';
      const oLogo = oAdv.logo_url
        ? `<img src="${esc(oAdv.logo_url)}" alt="" onerror="this.parentElement.textContent='${esc(oName.charAt(0).toUpperCase())}'">`
        : esc(oName.charAt(0).toUpperCase());
      return `
        <a class="other-card" href="/b/${esc(o.slug)}">
          <div class="other-logo">${oLogo}</div>
          <div class="other-body">
            <div class="other-name">${esc(oName)}</div>
            <div class="other-tag">${esc(oTag)}</div>
          </div>
          <i class="fa-solid fa-arrow-right other-arrow"></i>
        </a>`;
    }).join('');
    othersHtml = `
      <section class="others-section">
        <h2>🇿🇲 Discover other Zambian businesses</h2>
        <p class="sub">More businesses on PhoneYa2</p>
        <div class="others-grid">${cards}</div>
      </section>`;
  }

  const bodyHtml = `
    <div class="wrap">
      <div class="topbar-mini">
        <a class="brand-link" href="/">
          <span class="brand-mark">📱</span>
          <div class="brand-text">
            <b>PhoneYa2 <span>Ads</span></b>
            <small>Zambian Businesses</small>
          </div>
        </a>
        <a class="shop-link" href="/shop.html">Shop accessories <i class="fa-solid fa-arrow-right"></i></a>
      </div>

      ${coverHtml}

      <div class="profile-card">
        <div class="profile-head">
          <div class="logo-box">${logoHtml}</div>
          <div class="profile-info">
            <h1 class="profile-name">${esc(bizName)} ${verifiedBadge} ${tierBadgeHtml}</h1>
            ${tagline ? `<p class="profile-tagline">${esc(tagline)}</p>` : ''}
          </div>
        </div>

        ${contactButtons.length ? `<div class="contact-row">${contactButtons.join('')}</div>` : ''}
        ${socialsHtml}

        ${aboutHtml}
      </div>

      ${adsHtml}

      ${othersHtml}

      <div class="advertise-strip">
        <div>
          <h3>Want a profile like this for your business?</h3>
          <p>Advertise on PhoneYa2 and get a free business profile. Upgrade anytime for custom branding and more visibility.</p>
        </div>
        <a href="/advertise/">Get started <i class="fa-solid fa-arrow-right"></i></a>
      </div>
    </div>

    <script>
      window.__PY2_PROFILE_SLUG__ = ${JSON.stringify(profile.slug)};
    </script>
  `;

  const ogTitle = bizName + (tagline ? ' — ' + tagline : '') + ' | PhoneYa2';
  const ogDesc  = about
    ? about.slice(0, 155)
    : (tagline || 'Discover this Zambian business on PhoneYa2.');
  const ogImage = cover || (ads[0] && ads[0].media_url) || FALLBACK_OG_IMAGE;
  const canonical = SITE_URL + '/b/' + encodeURIComponent(profile.slug);

  const html = renderShell({
    title: ogTitle,
    description: ogDesc,
    ogImage,
    canonicalUrl: canonical,
    bodyHtml,
    primaryColor,
    accentColor,
    isProfile: true
  });

  const source = detectSource(request.headers.get('referer') || '');
  context.waitUntil(recordView(profile.slug, source));

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
    }
  });
}
