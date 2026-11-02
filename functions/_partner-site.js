const SITE_URL = "https://phoneya2.pages.dev";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function safeUrl(value) {
  const candidate = String(value || "").trim();
  if (candidate.startsWith("/media/partner/")) return candidate;
  try {
    const parsed = new URL(candidate);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function safeActionUrl(value) {
  const candidate = String(value || "").trim();
  if (candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.includes("\\")) return candidate;
  if (candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.includes("\\")) return candidate;
  try {
    const parsed = new URL(candidate);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : "";
  } catch { return ""; }
}
function cleanPostLabel(value) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, 32);
}

function money(item) {
  if (item.price_label) return esc(item.price_label);
  if (item.price_minor == null) return "Contact for price";
  return "K" + (Number(item.price_minor) / 100).toFixed(2);
}

function renderItem(item, primary) {
  const image = safeUrl(item.image_url);
  return `<article class="product">
    ${image
      ? `<img class="product-image" src="${esc(image)}" alt="${esc(item.title)}" loading="lazy" decoding="async" onerror="this.style.display='none'">`
      : '<div class="product-placeholder">PY2</div>'}
    <div class="product-body">
      <small>${esc(item.item_type === "service" ? "SERVICE" : item.category || "PRODUCT")}</small>
      <h3>${esc(item.title)}</h3>
      ${item.summary ? `<p>${esc(item.summary)}</p>` : ""}
      <div class="product-bottom"><b>${money(item)}</b><a href="#contact">Enquire ↗</a></div>
    </div>
  </article>`;
}

export function renderPartnerSite(data) {
  const site = data.site || {};
  const business = data.advertiser || {};
  const items = data.items || [];
  const posts = data.posts || [];
  const primary = /^#[0-9a-f]{6}$/i.test(site.primary_color || "") ? site.primary_color : "#ff6000";
  const accent = /^#[0-9a-f]{6}$/i.test(site.accent_color || "") ? site.accent_color : "#173f73";
  const businessName = business.business_name || "PhoneYa2 Partner";
  const logoUrl = safeUrl(site.logo_url || business.logo_url);
  const heroImage = safeUrl(site.hero_image_url);
  let socials = {};
  try { socials = JSON.parse(site.social_links_json || "{}"); } catch { socials = {}; }

  const logo = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="${esc(businessName)}" decoding="async" onerror="this.remove()">`
    : `<span>${esc(businessName.charAt(0).toUpperCase())}</span>`;

  const socialHtml = Object.entries(socials)
    .filter(([key, value]) => ["website", "facebook", "instagram", "tiktok", "youtube"].includes(key) && safeUrl(value))
    .map(([key, value]) => `<a href="${esc(safeUrl(value))}" target="_blank" rel="noopener">${esc(key.charAt(0).toUpperCase() + key.slice(1))}</a>`)
    .join("");

  const whatsapp = String(socials.whatsapp || business.phone || "").replace(/\D/g, "");
  const contact = (whatsapp
    ? `<a class="btn primary whatsapp-btn" href="https://wa.me/${esc(whatsapp)}" target="_blank" rel="noopener" style="background:#25D366!important;color:#111!important;border:1px solid #1eae52!important;text-decoration:none">WhatsApp us ↗</a>`
    : "") + (business.phone
      ? `<a class="btn secondary" href="tel:${esc(business.phone)}">Call business</a>`
      : "");

  const products = items.filter((item) => item.item_type === "product");
  const services = items.filter((item) => item.item_type === "service");

  const catalogue = (list, heading, eyebrow) => list.length
    ? `<section class="section" id="${heading.toLowerCase()}">
        <div class="section-head"><div><small>${esc(eyebrow)}</small><h2>${esc(heading)}</h2></div><span>${list.length} listed</span></div>
        <div class="products">${list.map((item) => renderItem(item, primary)).join("")}</div>
      </section>`
    : "";

  const postMeta = {
    offer: { label: "SPECIAL OFFER", icon: "✦", action: "Claim this offer", tone: "offer" },
    event: { label: "UPCOMING EVENT", icon: "✦", action: "View event details", tone: "event" },
    update: { label: "BUSINESS UPDATE", icon: "↗", action: "Read more", tone: "update" }
  };
  const postsHtml = posts.length
    ? `<section class="section" id="updates">
        <div class="section-head"><div><small>WHAT'S HAPPENING</small><h2>Stories, offers &amp; announcements</h2></div><span>${posts.length} updates</span></div>
        <div class="posts">${posts.map((post) => {
          const type = String(post.post_type || "update").toLowerCase();
          const meta = postMeta[type] || { label: type.replace(/[_-]/g, " ").toUpperCase(), icon: "✦", action: "Discover more", tone: "update" };
          const cover = safeUrl(post.cover_image_url);
          const action = safeActionUrl(post.cta_url) || "#contact";
          const actionLabel = cleanPostLabel(post.cta_label) || meta.action;
          const external = action.startsWith("https://") || action.startsWith("http://");
          const body = post.excerpt || String(post.body || "").slice(0, 220);
          return `<article class="post post--${esc(meta.tone)}">
            <div class="post-art">${cover ? `<img src="${esc(cover)}" alt="${esc(post.title)}" loading="lazy" decoding="async" onerror="this.style.display='none'">` : `<span class="post-art-icon">${meta.icon}</span>`}
              <span class="post-type-pill">${esc(meta.label)}</span>
            </div>
            <div class="post-copy">
              <div class="post-kicker"><span>${meta.icon} ${esc(meta.label)}</span></div>
              <h3>${esc(post.title)}</h3>
              <p>${esc(body)}</p>
              <a class="post-cta" href="${esc(action)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${esc(actionLabel)} <span aria-hidden="true">↗</span></a>
            </div>
          </article>`;
        }).join("")}</div>
      </section>`
    : "";

  const title = site.seo_title || site.site_title || businessName;
  const description = site.seo_description || site.site_description || `Discover ${businessName} on PhoneYa2.`;
  const canonicalSlug = encodeURIComponent(data.slug || "");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="${esc(primary)}">
<link rel="canonical" href="${SITE_URL}/b/${canonicalSlug}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${heroImage ? `<meta property="og:image" content="${esc(heroImage)}">` : ""}
<style>
*{box-sizing:border-box}
body{margin:0;background:#f6f8fb;color:#172b48;font:15px/1.65 system-ui,-apple-system,Segoe UI,sans-serif;position:relative}body:before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;${heroImage ? `background:linear-gradient(rgba(246,248,251,.93),rgba(246,248,251,.97)),url("${heroImage}") center/cover fixed;` : ""}}
a{color:inherit;text-decoration:none}
.site{max-width:1240px;margin:auto;padding:0 22px;position:relative;z-index:1}.template-studio .site{max-width:1320px}.template-hospitality .site{max-width:1100px}.template-storefront .products{grid-template-columns:repeat(4,minmax(0,1fr))}.template-studio .hero{min-height:520px;text-align:center;justify-content:center}.template-studio .hero-content{margin:auto}.template-hospitality .hero{min-height:460px;border-radius:4px}.template-professional .hero{min-height:340px;border-radius:12px}
.top{height:76px;display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid #e7ebf1;position:sticky;top:0;z-index:20;background:#fffffff2;backdrop-filter:blur(18px);padding:0 20px;margin:0 -18px;box-shadow:0 5px 22px #142b4a08}
.brand{display:flex;align-items:center;gap:12px;min-width:0;font-weight:850;font-size:19px;letter-spacing:-.35px;color:#172b48}
.logo{width:44px;height:44px;flex:0 0 44px;border-radius:13px;background:${primary};color:white;display:grid;place-items:center;overflow:hidden;box-shadow:0 4px 12px #142b4a18}
.logo img{width:100%;height:100%;object-fit:contain;padding:3px}
.top small{display:none}
.top-menu-wrap{position:relative;margin-left:auto;z-index:100}.top-menu-wrap>summary{list-style:none}.top-menu-wrap>summary::-webkit-details-marker{display:none}.top-menu-wrap[open]>.site-nav{display:flex}.site-nav{z-index:1000;pointer-events:auto}
.top-link{font-weight:750;color:#63748a;font-size:13px}
.site-nav{display:none;position:absolute;right:0;top:calc(100% + 13px);width:min(280px,calc(100vw - 32px));margin:0;padding:9px;background:#fff;border:1px solid #e4eaf1;border-radius:15px;box-shadow:0 18px 48px #132b4a20;flex-direction:column;align-items:stretch;gap:3px}
.site-nav.open{display:flex}
.site-nav a{display:flex;align-items:center;min-height:42px;padding:10px 12px;border-radius:9px;font-size:13px;font-weight:750;color:#31445b}
.site-nav a:hover{background:#f1f5fa;color:${primary}}
.site-nav .nav-cta{background:${primary};color:#fff;margin-top:4px}
.site-nav .nav-cta:hover{filter:brightness(.96);color:#fff}
.menu-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:46px;height:44px;border:1px solid #dfe6ef;background:#f7f9fc;color:#172b48;border-radius:12px;padding:0 13px;font-size:13px;font-weight:850;cursor:pointer;box-shadow:0 2px 7px #142b4a08}
.menu-button:hover,.menu-button[aria-expanded="true"]{background:#edf3fa;border-color:#c5d3e3}
.menu-button:focus-visible{outline:3px solid #8bbcf0;outline-offset:2px}
.hero{margin:22px 0 0;min-height:440px;border-radius:24px;overflow:hidden;position:relative;display:flex;align-items:end;background:linear-gradient(110deg,${accent} 0%,#142b48 100%);color:white}
.hero:before{content:"";position:absolute;inset:0;background:${heroImage ? `linear-gradient(90deg,rgba(9,24,43,.88),rgba(9,24,43,.18)),url("${heroImage}") center/cover` : "radial-gradient(circle at 85% 20%,rgba(255,255,255,.2),transparent 30%)"}}
.hero-content{position:relative;z-index:1;padding:clamp(26px,6vw,65px);max-width:760px}
.eyebrow{font-size:11px;letter-spacing:1.8px;text-transform:uppercase;font-weight:850;color:#ffd0b2}
.hero h1{font-size:clamp(34px,5.6vw,64px);line-height:1.04;letter-spacing:-2px;margin:13px 0}
.hero p{max-width:600px;color:#e2eaf3;font-size:16px}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}
.btn{display:inline-flex;padding:11px 16px;border-radius:10px;font-weight:800;font-size:13px}
.primary{background:${primary};color:white}.contact .btn.primary,.contact .whatsapp-btn,.whatsapp-btn{background:#25D366!important;background-color:#25D366!important;color:#111!important;-webkit-text-fill-color:#111!important;border:1px solid #1eae52!important;box-shadow:0 7px 18px #25D36635;text-decoration:none!important}.contact .btn.primary:hover,.contact .whatsapp-btn:hover,.whatsapp-btn:hover{background:#20bd5a!important;background-color:#20bd5a!important;color:#111!important;-webkit-text-fill-color:#111!important}
.secondary{background:#ffffff20;border:1px solid #ffffff55;color:white}
.section{padding:50px 0 5px}
.section-head{display:flex;justify-content:space-between;align-items:end;margin-bottom:17px}
.section-head small{font-size:10px;letter-spacing:1.5px;font-weight:850;color:${primary}}
.section-head h2{font-size:27px;letter-spacing:-.8px;margin:4px 0}
.section-head span{color:#8793a3;font-size:12px}
.products{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:17px}
.product,.post{background:white;border:1px solid #e7ebf1;border-radius:16px;overflow:hidden;box-shadow:0 9px 26px #14233b0a}
.product-image,.product-placeholder{width:100%;height:205px;object-fit:cover;background:#edf1f6}
.product-placeholder{display:grid;place-items:center;color:#91a1b5;font-size:30px;font-weight:900}
.product-body{padding:16px}
.product-body small,.post small{font-size:10px;color:${primary};font-weight:850;letter-spacing:1px;text-transform:uppercase}
.product h3,.post h3{margin:5px 0;font-size:17px}
.product p,.post p{color:#748197;font-size:13px;margin:5px 0 12px}
.product-bottom{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #edf0f4;padding-top:12px;margin-top:12px}
.product-bottom b{font-size:14px}
.product-bottom a{color:${primary};font-weight:850;font-size:12px}
.posts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.posts{grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;align-items:stretch}
.post{position:relative;border:0;border-radius:22px;overflow:hidden;box-shadow:0 14px 36px #14233b12;transition:transform .22s ease,box-shadow .22s ease}
.post:hover{transform:translateY(-5px);box-shadow:0 20px 44px #14233b1c}
.post .post-art{padding:0}.post .post-copy{padding:20px}
.post-art{height:218px;position:relative;display:grid;place-items:center;overflow:hidden;background:linear-gradient(135deg,#dceeff,#edf4ff)}
.post-art img{width:100%;height:100%;max-height:none;aspect-ratio:auto;object-fit:contain;padding:14px;background:transparent}
.post-art-icon{font-size:70px;font-weight:900;color:#fff;text-shadow:0 8px 25px #14233b35}
.post-type-pill{position:absolute;top:15px;left:15px;border-radius:999px;padding:7px 11px;background:#fff;color:#233a57;font-size:9px;font-weight:950;letter-spacing:1px;box-shadow:0 5px 16px #14233b18}
.post-copy{padding:20px;display:flex;flex-direction:column;flex:1}
.post-kicker{font-size:10px;font-weight:900;letter-spacing:1px;margin-bottom:7px;color:#5c718c}
.post h3{font-size:20px;line-height:1.2;letter-spacing:-.45px;margin:0 0 9px;color:#172b48}
.post p{font-size:13px;line-height:1.7;color:#65758c;margin:0 0 19px;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-line}
.post-cta{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 15px;border-radius:12px;background:#173f73;color:#fff;font-size:12px;font-weight:900;box-shadow:0 7px 16px #173f7328}
.post-cta:hover{filter:brightness(1.08);transform:translateY(-1px)}
.post--offer{background:linear-gradient(150deg,#fff7e8,#fff 62%);border:1px solid #ffdfae}
.post--offer .post-art{background:linear-gradient(130deg,#ff9d38,#f24c52 58%,#c92d72)}
.post--offer .post-type-pill{color:#b94721}
.post--offer .post-kicker{color:#d65a2e}
.post--offer .post-cta{background:linear-gradient(100deg,#f05b2c,#e52f57);box-shadow:0 8px 18px #e94a4935}
.post--event{background:linear-gradient(150deg,#f0edff,#fff 65%);border:1px solid #dcd4ff}
.post--event .post-art{background:linear-gradient(130deg,#4f46e5,#8b5cf6 58%,#d16bdc)}
.post--event .post-type-pill{color:#5541c7}
.post--event .post-kicker{color:#6653d4}
.post--event .post-cta{background:linear-gradient(100deg,#5145d8,#8b5cf6);box-shadow:0 8px 18px #6c56df35}
.post--update{background:linear-gradient(150deg,#e9fbf8,#fff 65%);border:1px solid #ccefe8}
.post--update .post-art{background:linear-gradient(130deg,#087f8c,#18a999 58%,#69c6a9)}
.post--update .post-type-pill{color:#087f8c}
.post--update .post-kicker{color:#0b8c83}
.post--update .post-cta{background:linear-gradient(100deg,#087f8c,#16a394);box-shadow:0 8px 18px #0b938735}
@media(max-width:900px){.posts{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.posts{grid-template-columns:1fr;gap:14px}.post-art{height:205px}.post-copy{padding:17px}.post h3{font-size:18px}}

.post img{width:100%;height:190px;object-fit:cover}
.post div{padding:16px}
.about{margin-top:45px;background:white;border:1px solid #e7ebf1;border-radius:18px;padding:24px}
.about h2{margin:0 0 8px}
.about p{color:#687990;white-space:pre-wrap}
.contact{margin:50px 0 25px;background:#142f50;color:white;border-radius:20px;padding:clamp(24px,5vw,45px);display:grid;grid-template-columns:1fr 1fr;gap:25px}
.contact h2{font-size:28px;margin:0}
.contact p{color:#d1dce8}
.contact form{display:grid;gap:10px}
.contact input,.contact textarea{width:100%;padding:12px;border:1px solid #ffffff35;border-radius:9px;background:#ffffff12;color:white}
.contact input::placeholder,.contact textarea::placeholder{color:#c1cfde}
.contact textarea{min-height:90px}
.contact button{border:0;background:${primary};color:white;border-radius:9px;padding:12px;font-weight:850}
.socials{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
.socials a{padding:7px 11px;background:#eef2f7;border-radius:20px;font-size:11px;font-weight:800}
.footer{padding:20px 0 32px;display:flex;justify-content:space-between;color:#8995a5;font-size:11px}
.footer b{color:#52647c}

/* Partner mini-site media and sponsored placements */
.product-image,.post img{display:block;width:100%;height:auto;max-height:340px;aspect-ratio:4/3;object-fit:contain;background:#f1f4f8;padding:8px}
.product-image{aspect-ratio:1/1;max-height:300px}
.post img{aspect-ratio:16/9;max-height:320px}
.product,.post{display:flex;flex-direction:column;min-width:0}
.product-body,.post>div{flex:1}
.post p{display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-line}
.product p{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.product-bottom{margin-top:auto}
.sponsored-section{margin-top:12px;padding:34px 0 8px}
.sponsored-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.sponsored-card{overflow:hidden;background:#fff;border:1px solid #e5eaf1;border-radius:16px;box-shadow:0 9px 26px #14233b0a;min-width:0}
.sponsored-media{height:210px;position:relative;background:#eef2f7;overflow:hidden;display:grid;place-items:center}
.sponsored-media img,.sponsored-media video,.sponsored-media iframe{width:100%;height:100%;object-fit:contain;border:0}
.sponsored-label{position:absolute;z-index:2;top:10px;left:10px;background:#142f50ef;color:#fff;border-radius:7px;padding:5px 8px;font-size:10px;font-weight:900;letter-spacing:.5px;text-transform:uppercase}
.sponsored-copy{padding:15px}
.sponsored-business{font-size:10px;color:#8491a2;font-weight:850;letter-spacing:1px;text-transform:uppercase}
.sponsored-copy h3{font-size:17px;margin:5px 0}
.sponsored-copy p{font-size:13px;color:#748197;line-height:1.6;margin:6px 0 13px}
.sponsored-cta{display:flex;justify-content:space-between;align-items:center;color:#fff;background:#173f73;border-radius:9px;padding:10px 12px;font-size:12px;font-weight:850}
.sponsored-section[hidden]{display:none}

.partner-ad-popup{position:fixed;inset:0;z-index:99;background:#081a30b8;display:grid;place-items:center;padding:18px}
.partner-ad-popup[hidden]{display:none}
.partner-ad-popup-card{position:relative;width:min(560px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 25px 90px #0005}
.partner-ad-popup-close{position:absolute;right:12px;top:12px;z-index:3;width:36px;height:36px;border:0;border-radius:50%;background:#102b4e;color:#fff;font-size:20px;cursor:pointer}
.partner-ad-popup .sponsored-media{height:260px}
@media(max-width:600px){.partner-ad-popup .sponsored-media{height:190px}}
@media(max-width:760px){.sponsored-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.sponsored-media{height:155px}.sponsored-copy{padding:12px}.sponsored-copy h3{font-size:14px}}
@media(max-width:420px){.sponsored-grid{grid-template-columns:1fr}.sponsored-media{height:210px}}
@media(max-width:760px){.site{padding:0 13px}.site-nav{display:none;position:absolute;top:64px;left:0;right:0;margin:0;padding:14px;background:white;border-bottom:1px solid #e7ebf1;box-shadow:0 10px 22px #132b4a15;flex-direction:column;align-items:stretch;gap:12px}.site-nav.open{display:flex}.menu-button{display:inline-flex;margin-left:auto;margin-right:9px}.top-link{font-size:11px}.top{margin:0 -13px;padding:0 10px}.template-storefront .products{grid-template-columns:repeat(2,minmax(0,1fr))}.template-studio .hero{min-height:390px}.top{height:65px}.hero{min-height:360px;border-radius:17px}.hero h1{font-size:38px}.hero p{font-size:14px}.products{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.product-image,.product-placeholder{height:155px}.product-body{padding:12px}.product h3{font-size:14px}.posts{grid-template-columns:1fr}.contact{grid-template-columns:1fr;margin:35px 0 20px}.section{padding-top:34px}.section-head h2{font-size:23px}.footer{display:block}.footer span{display:block;margin-top:5px}}
@media(max-width:400px){.products{grid-template-columns:1fr}.product-image,.product-placeholder{height:210px}}
/* Keep the compact brand + menu header consistent on desktop and mobile */
@media(max-width:760px){.site-nav{display:none;position:absolute;top:calc(100% + 13px);left:auto;right:0;width:min(280px,calc(100vw - 32px));margin:0;padding:9px;background:#fff;border:1px solid #e4eaf1;border-radius:15px;box-shadow:0 18px 48px #132b4a20;flex-direction:column;align-items:stretch;gap:3px}.site-nav.open{display:flex}.menu-button{display:inline-flex;margin-left:0;margin-right:0}.top-link{display:none}.top{height:66px;padding:0 12px;margin:0 -13px}}
</style>
</head>
<body>
<div class="site">
<header class="top"><div class="brand"><div class="logo">${logo}</div><div>${esc(businessName)}</div></div><details class="top-menu-wrap"><summary class="menu-button" aria-label="Open website menu"><span class="menu-icon" aria-hidden="true">☰</span><span>Menu</span></summary><nav id="site-nav" class="site-nav" aria-label="Business website menu"><a href="#products">🛍️ Products</a><a href="#services">🧰 Services</a><a href="#updates">📰 Updates</a><a href="#about">ℹ️ About</a><a class="nav-cta" href="#contact">✉️ Contact</a><a href="/">↗ Shop PhoneYa2</a></nav></details></header>
<section class="hero"><div class="hero-content"><div class="eyebrow">${esc(site.template_key || "BUSINESS")} · PHONEYA2 PARTNER</div><h1>${esc(site.hero_title || businessName)}</h1><p>${esc(site.hero_subtitle || site.site_description || "Discover our products and services.")}</p><div class="actions">${contact}</div></div></section>
<section class="section sponsored-section" id="partner-sponsored" hidden><div class="section-head"><div><small>PHONEYA2 AD NETWORK</small><h2>Sponsored for you</h2></div><span>Verified campaigns</span></div><div class="sponsored-grid" id="partner-sponsored-list"></div></section>
${catalogue(products, "Products", "OUR CATALOGUE")}
${catalogue(services, "Services", "WHAT WE DO")}
${postsHtml}
${site.site_description ? `<section class="about" id="about"><h2>About ${esc(businessName)}</h2><p>${esc(site.site_description)}</p></section>` : ""}
<section class="contact" id="contact">
<div><small class="eyebrow">LET&#39;S CONNECT</small><h2>How can we help you?</h2><p>Send an enquiry and ${esc(businessName)} will be able to follow up with you.</p>${contact}<div class="socials">${socialHtml}</div></div>
<form id="partner-enquiry"><input name="name" required maxlength="100" placeholder="Your name"><input name="phone" maxlength="40" placeholder="Phone number"><input name="email" type="email" maxlength="254" placeholder="Email address"><textarea name="message" required maxlength="2000" placeholder="How can we help?"></textarea><input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px"><button type="submit">Send enquiry →</button><small id="enquiry-result" aria-live="polite"></small></form>
</section>
<div class="partner-ad-popup" id="partner-ad-popup" hidden role="dialog" aria-modal="true" aria-label="Sponsored advertisement"><div class="partner-ad-popup-card"><button class="partner-ad-popup-close" id="partner-ad-popup-close" aria-label="Close advertisement">×</button><div id="partner-ad-popup-content"></div></div></div>
<footer class="footer"><b>PhoneYa2 Partners</b><span>Smart CHOICES. Better CONNECTED · Zambia</span></footer>
</div>
<script>
// The website menu uses native <details>/<summary> so it opens without JavaScript.

function appendPartnerAdMedia(container,ad){
  const url=String(ad.media_url||"");
  if(!url)return;
  if(ad.media_type!=="video"){
    const image=document.createElement("img");image.src=url;image.alt=ad.title||"Sponsored campaign";image.loading="lazy";image.onerror=()=>image.remove();container.appendChild(image);return;
  }
  let provider=ad.video_provider||"";
  if(!provider){if(/youtube\.com|youtu\.be/i.test(url))provider="youtube";else if(/vimeo\.com/i.test(url))provider="vimeo";else if(/tiktok\.com/i.test(url))provider="tiktok";else provider="mp4";}
  if(provider==="youtube"){
    const match=url.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
    if(match){const frame=document.createElement("iframe");frame.src="https://www.youtube.com/embed/"+match[1]+"?autoplay=1&mute=1&loop=1&playlist="+match[1]+"&controls=0&playsinline=1";frame.allow="autoplay; encrypted-media";frame.allowFullscreen=true;frame.title=ad.title||"Sponsored video";container.appendChild(frame);}
    return;
  }
  if(provider==="vimeo"){
    const match=url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if(match){const frame=document.createElement("iframe");frame.src="https://player.vimeo.com/video/"+match[1]+"?autoplay=1&muted=1&loop=1&background=1";frame.allow="autoplay";frame.allowFullscreen=true;frame.title=ad.title||"Sponsored video";container.appendChild(frame);}
    return;
  }
  if(provider==="tiktok"){
    const fallback=document.createElement("div");fallback.textContent="TikTok video";fallback.style.cssText="color:#fff;background:linear-gradient(135deg,#111,#fe2c55);width:100%;height:100%;display:grid;place-items:center;font-weight:800";container.appendChild(fallback);return;
  }
  const video=document.createElement("video");video.src=url;video.muted=true;video.autoplay=true;video.loop=true;video.playsInline=true;container.appendChild(video);
}
async function loadPartnerAds(){
  const section=document.getElementById("partner-sponsored"),list=document.getElementById("partner-sponsored-list");
  if(!section||!list)return;
  try{
    const response=await fetch("/api/partner-ads",{cache:"no-store",credentials:"same-origin"});
    if(!response.ok)return;
    const payload=await response.json(),allAds=payload.ads||[];
    const carouselAds=allAds.filter(ad=>!ad.placement||ad.placement==="carousel"||ad.placement==="both").slice(0,6);
    for(const ad of carouselAds){
      const card=document.createElement("article");card.className="sponsored-card";
      const media=document.createElement("div");media.className="sponsored-media";
      const tag=document.createElement("span");tag.className="sponsored-label";tag.textContent="Sponsored";media.appendChild(tag);
      appendPartnerAdMedia(media,ad);
      const copy=document.createElement("div");copy.className="sponsored-copy";
      const business=document.createElement("div");business.className="sponsored-business";business.textContent=ad.business_name||(ad.advertisers&&ad.advertisers.business_name)||"Zambian business";
      const title=document.createElement("h3");title.textContent=ad.title||"Featured offer";
      const desc=document.createElement("p");desc.textContent=ad.description||"Discover this business on PhoneYa2.";
      const link=document.createElement("a");link.className="sponsored-cta";link.href=ad.profile_slug?"/b/"+encodeURIComponent(ad.profile_slug):"/ad/"+encodeURIComponent(ad.slug||"");link.innerHTML="<span>View business profile</span><span>↗</span>";
      link.addEventListener("click",()=>trackPartnerAd(ad.id,"click","carousel"));
      copy.append(business,title,desc,link);card.append(media,copy);list.appendChild(card);
      trackPartnerAd(ad.id,"impression","carousel");
    }
    if(carouselAds.length)section.hidden=false;
    const popupAds=allAds.filter(ad=>ad.placement==="popup"||ad.placement==="both");
    if(popupAds.length&&!sessionStorage.getItem("py2_partner_popup_seen")){
      window.setTimeout(()=>showPartnerAdPopup(popupAds[0]),22000);
    }
  }catch(error){console.warn("Partner sponsored campaigns unavailable",error);}
}
function trackPartnerAd(id,action,placement){
  fetch("/api/partner-ads",{method:"POST",headers:{"content-type":"application/json"},keepalive:true,body:JSON.stringify({action,ad_id:id,placement,source:"other"})}).catch(()=>{});
}
function showPartnerAdPopup(ad){
  const overlay=document.getElementById("partner-ad-popup"),content=document.getElementById("partner-ad-popup-content");
  if(!overlay||!content||overlay.dataset.opened==="1")return;
  overlay.dataset.opened="1";sessionStorage.setItem("py2_partner_popup_seen","1");
  const media=document.createElement("div");media.className="sponsored-media";
  const tag=document.createElement("span");tag.className="sponsored-label";tag.textContent="Sponsored";media.appendChild(tag);
  appendPartnerAdMedia(media,ad);
  const copy=document.createElement("div");copy.className="sponsored-copy";
  const business=document.createElement("div");business.className="sponsored-business";business.textContent=ad.business_name||(ad.advertisers&&ad.advertisers.business_name)||"Zambian business";
  const title=document.createElement("h3");title.textContent=ad.title||"Featured offer";
  const desc=document.createElement("p");desc.textContent=ad.description||"Discover this business on PhoneYa2.";
  const link=document.createElement("a");link.className="sponsored-cta";link.href=ad.profile_slug?"/b/"+encodeURIComponent(ad.profile_slug):"/ad/"+encodeURIComponent(ad.slug||"");link.innerHTML="<span>View business profile</span><span>↗</span>";
  link.addEventListener("click",()=>trackPartnerAd(ad.id,"click","popup"));
  copy.append(business,title,desc,link);content.replaceChildren(media,copy);overlay.hidden=false;trackPartnerAd(ad.id,"impression","popup");
}
document.getElementById("partner-ad-popup-close").addEventListener("click",()=>{document.getElementById("partner-ad-popup").hidden=true;});
document.getElementById("partner-ad-popup").addEventListener("click",event=>{if(event.target.id==="partner-ad-popup")event.currentTarget.hidden=true;});

loadPartnerAds();
document.getElementById("partner-enquiry").addEventListener("submit", async function(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  const output = document.getElementById("enquiry-result");
  button.disabled = true;
  output.textContent = "Sending…";
  try {
    const body = Object.fromEntries(new FormData(form).entries());
    body.slug = ${JSON.stringify(data.slug || "")};
    const response = await fetch("/api/partner-enquiry", {
      method: "POST",
      headers: { "content-type": "application/json", "accept": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Could not send enquiry.");
    form.reset();
    output.textContent = "Thank you. Your enquiry has been sent.";
  } catch (error) {
    output.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
</script>
</body>
</html>`;
}
