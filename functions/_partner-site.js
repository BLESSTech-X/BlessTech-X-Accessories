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

function money(item) {
  if (item.price_label) return esc(item.price_label);
  if (item.price_minor == null) return "Contact for price";
  return "K" + (Number(item.price_minor) / 100).toFixed(2);
}

function renderItem(item, primary) {
  const image = safeUrl(item.image_url);
  return `<article class="product">
    ${image
      ? `<img class="product-image" src="${esc(image)}" alt="${esc(item.title)}" loading="lazy">`
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
    ? `<img src="${esc(logoUrl)}" alt="${esc(businessName)}">`
    : `<span>${esc(businessName.charAt(0).toUpperCase())}</span>`;

  const socialHtml = Object.entries(socials)
    .filter(([key, value]) => ["website", "facebook", "instagram", "tiktok", "youtube"].includes(key) && safeUrl(value))
    .map(([key, value]) => `<a href="${esc(safeUrl(value))}" target="_blank" rel="noopener">${esc(key.charAt(0).toUpperCase() + key.slice(1))}</a>`)
    .join("");

  const whatsapp = String(socials.whatsapp || business.phone || "").replace(/\D/g, "");
  const contact = (whatsapp
    ? `<a class="btn primary" href="https://wa.me/${esc(whatsapp)}" target="_blank" rel="noopener">WhatsApp us ↗</a>`
    : "") + (business.phone
      ? `<a class="btn secondary" href="tel:${esc(business.phone)}">Call business</a>`
      : "");

  const products = items.filter((item) => item.item_type === "product");
  const services = items.filter((item) => item.item_type === "service");

  const catalogue = (list, heading, eyebrow) => list.length
    ? `<section class="section">
        <div class="section-head"><div><small>${esc(eyebrow)}</small><h2>${esc(heading)}</h2></div><span>${list.length} listed</span></div>
        <div class="products">${list.map((item) => renderItem(item, primary)).join("")}</div>
      </section>`
    : "";

  const postsHtml = posts.length
    ? `<section class="section">
        <div class="section-head"><div><small>FROM THE BUSINESS</small><h2>News &amp; updates</h2></div></div>
        <div class="posts">${posts.map((post) => {
          const cover = safeUrl(post.cover_image_url);
          return `<article class="post">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy">` : ""}
            <div><small>${esc(post.post_type || "UPDATE")}</small><h3>${esc(post.title)}</h3>
            <p>${esc(post.excerpt || String(post.body || "").slice(0, 180))}</p></div>
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
.top{height:78px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e7ebf1;position:sticky;top:0;z-index:8;background:#ffffffeb;backdrop-filter:blur(16px);padding:0 18px;margin:0 -18px}
.brand{display:flex;align-items:center;gap:11px;font-weight:850;font-size:19px}
.logo{width:42px;height:42px;border-radius:13px;background:${primary};color:white;display:grid;place-items:center;overflow:hidden}
.logo img{width:100%;height:100%;object-fit:cover}
.top small{display:block;color:#8190a3;font-size:10px;letter-spacing:1.2px;text-transform:uppercase}
.top-link{font-weight:750;color:#63748a;font-size:13px}.site-nav{display:flex;align-items:center;gap:18px;margin-left:auto;margin-right:20px}.site-nav a{font-size:12px;font-weight:800;color:#65758a}.site-nav a:hover{color:${primary}}.site-nav .nav-cta{background:${primary};color:#fff;padding:9px 13px;border-radius:9px}.menu-button{display:none;border:0;background:#edf1f6;border-radius:9px;padding:8px 11px;font-weight:900}
.hero{margin:22px 0 0;min-height:440px;border-radius:24px;overflow:hidden;position:relative;display:flex;align-items:end;background:linear-gradient(110deg,${accent} 0%,#142b48 100%);color:white}
.hero:before{content:"";position:absolute;inset:0;background:${heroImage ? `linear-gradient(90deg,rgba(9,24,43,.88),rgba(9,24,43,.18)),url("${heroImage}") center/cover` : "radial-gradient(circle at 85% 20%,rgba(255,255,255,.2),transparent 30%)"}}
.hero-content{position:relative;z-index:1;padding:clamp(26px,6vw,65px);max-width:760px}
.eyebrow{font-size:11px;letter-spacing:1.8px;text-transform:uppercase;font-weight:850;color:#ffd0b2}
.hero h1{font-size:clamp(34px,5.6vw,64px);line-height:1.04;letter-spacing:-2px;margin:13px 0}
.hero p{max-width:600px;color:#e2eaf3;font-size:16px}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}
.btn{display:inline-flex;padding:11px 16px;border-radius:10px;font-weight:800;font-size:13px}
.primary{background:${primary};color:white}
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
@media(max-width:760px){.site{padding:0 13px}.site-nav{display:none;position:absolute;top:64px;left:0;right:0;margin:0;padding:14px;background:white;border-bottom:1px solid #e7ebf1;box-shadow:0 10px 22px #132b4a15;flex-direction:column;align-items:stretch;gap:12px}.site-nav.open{display:flex}.menu-button{display:inline-flex;margin-left:auto;margin-right:9px}.top-link{font-size:11px}.top{margin:0 -13px;padding:0 10px}.template-storefront .products{grid-template-columns:repeat(2,minmax(0,1fr))}.template-studio .hero{min-height:390px}.top{height:65px}.hero{min-height:360px;border-radius:17px}.hero h1{font-size:38px}.hero p{font-size:14px}.products{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.product-image,.product-placeholder{height:155px}.product-body{padding:12px}.product h3{font-size:14px}.posts{grid-template-columns:1fr}.contact{grid-template-columns:1fr;margin:35px 0 20px}.section{padding-top:34px}.section-head h2{font-size:23px}.footer{display:block}.footer span{display:block;margin-top:5px}}
@media(max-width:400px){.products{grid-template-columns:1fr}.product-image,.product-placeholder{height:210px}}
</style>
</head>
<body>
<div class="site">
<header class="top"><div class="brand"><div class="logo">${logo}</div><div>${esc(businessName)}<small>Partner business on PhoneYa2</small></div></div><nav id="site-nav" class="site-nav"><a href="#products">Products</a><a href="#services">Services</a><a href="#updates">Updates</a><a href="#about">About</a><a class="nav-cta" href="#contact">Contact</a></nav><button class="menu-button" id="site-menu" aria-label="Open website menu">☰</button><a class="top-link" href="/">Shop PhoneYa2 ↗</a></header>
<section class="hero"><div class="hero-content"><div class="eyebrow">${esc(site.template_key || "BUSINESS")} · PHONEYA2 PARTNER</div><h1>${esc(site.hero_title || businessName)}</h1><p>${esc(site.hero_subtitle || site.site_description || "Discover our products and services.")}</p><div class="actions">${contact}</div></div></section>
${catalogue(products, "Products", "OUR CATALOGUE")}
${catalogue(services, "Services", "WHAT WE DO")}
${postsHtml}
${site.site_description ? `<section class="about" id="about"><h2>About ${esc(businessName)}</h2><p>${esc(site.site_description)}</p></section>` : ""}
<section class="contact" id="contact">
<div><small class="eyebrow">LET&#39;S CONNECT</small><h2>How can we help you?</h2><p>Send an enquiry and ${esc(businessName)} will be able to follow up with you.</p>${contact}<div class="socials">${socialHtml}</div></div>
<form id="partner-enquiry"><input name="name" required maxlength="100" placeholder="Your name"><input name="phone" maxlength="40" placeholder="Phone number"><input name="email" type="email" maxlength="254" placeholder="Email address"><textarea name="message" required maxlength="2000" placeholder="How can we help?"></textarea><input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px"><button type="submit">Send enquiry →</button><small id="enquiry-result" aria-live="polite"></small></form>
</section>
<footer class="footer"><b>PhoneYa2 Partners</b><span>Smart CHOICES. Better CONNECTED · Zambia</span></footer>
</div>
<script>
document.getElementById("site-menu").addEventListener("click",function(){document.getElementById("site-nav").classList.toggle("open")});\ndocument.querySelectorAll("#site-nav a").forEach(a=>a.addEventListener("click",()=>document.getElementById("site-nav").classList.remove("open")));\ndocument.getElementById("partner-enquiry").addEventListener("submit", async function(event) {
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
