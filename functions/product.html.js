// Cloudflare Pages Function: server-render product sharing metadata for crawlers.
// Browser rendering remains handled by the existing product.html JavaScript.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function unquote(value) {
  const v = String(value ?? '').trim();
  if (v.length >= 2 && ((v[0] === '"' && v[v.length - 1] === '"') ||
      (v[0] === "'" && v[v.length - 1] === "'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function readFrontMatter(markdown) {
  const match = String(markdown).match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;

  const lines = match[1].split(/\r?\n/);
  const data = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!field) continue;

    const key = field[1];
    const raw = field[2].trim();
    if (key === 'description' && (raw === '|' || raw === '|-' || raw === '|+' || raw === '>' || raw === '>-')) {
      const parts = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) {
        parts.push(lines[++i].trim());
      }
      data[key] = parts.join(' ').replace(/\s+/g, ' ').trim();
    } else {
      data[key] = unquote(raw);
    }
  }
  return data;
}

function replaceMeta(html, regex, content) {
  const escaped = escapeHtml(content);
  if (regex.test(html)) {
    return html.replace(regex, (tag) =>
      tag.replace(/content=(["'])[^"']*\1/i, 'content="' + escaped + '"'));
  }
  return html;
}


function categoryGuide(category) {
  const key = String(category || '').toLowerCase();
  if (['case', 'protector'].includes(key)) return {
    heading: 'Check fit before ordering',
    intro: 'Protective accessories depend on the exact device model. Similar-looking phones can have different dimensions, camera layouts and button positions.',
    checks: ['Confirm the full phone model and version.', 'Compare the camera opening, button positions and connector cut-outs with your device.', 'Read the listing for stated materials, coverage and any limitations.']
  };
  if (['charger', 'cable'].includes(key)) return {
    heading: 'Check charging compatibility',
    intro: 'A connector that fits is not by itself proof that a charger supports your phone’s preferred charging speed.',
    checks: ['Confirm the connector at both ends of the cable.', 'Check your phone’s supported charging standard and the adapter output.', 'Do not use damaged cables or adapters, or equipment that smells burnt, buzzes or becomes unusually hot.']
  };
  if (key === 'earphone') return {
    heading: 'Check how it connects',
    intro: 'Earphones differ by connector, wireless features, controls and microphone support. Confirm the details that matter for your phone.',
    checks: ['Confirm whether the item is wired or Bluetooth.', 'For wired options, check the connector and whether your phone supports it directly.', 'Review the listing for microphone, controls, battery and included accessories rather than assuming they are present.']
  };
  if (key === 'powerbank') return {
    heading: 'Choose for your everyday use',
    intro: 'Capacity is only one part of a power bank. Port selection, output and the cable you use affect how convenient it is.',
    checks: ['Check the stated capacity and output ports on the listing.', 'Confirm that the output and cable suit your phone.', 'Inspect the casing and ports; do not use a swollen, cracked or unusually hot power bank.']
  };
  if (key === 'watch') return {
    heading: 'Check phone and feature compatibility',
    intro: 'Smartwatch features and companion apps vary by model. Confirm what the specific listing includes before you order.',
    checks: ['Check compatibility with your phone and its operating system.', 'Review the listed features and whether an app is required.', 'Confirm the charging method, included accessories and any stated limitations.']
  };
  if (key === 'phone') return {
    heading: 'Confirm the exact device details',
    intro: 'Phone model, storage, condition and included accessories can vary. Ask questions before paying if any detail is unclear.',
    checks: ['Confirm the exact model, storage capacity and stated condition.', 'Ask what accessories, warranty or return terms are included.', 'Inspect the device and verify its basic functions and account status before completing a second-hand purchase.']
  };
  return {
    heading: 'What to check before ordering',
    intro: 'Product names and photos are a starting point. Use the listing details to confirm the item matches your needs.',
    checks: ['Read the full description and check any stated limitations.', 'Confirm compatibility with your device or intended use.', 'Ask PhoneYa2 about unclear specifications, availability or delivery before ordering.']
  };
}

function renderCrawlerProduct(product, slug, url) {
  const esc = escapeHtml;
  const title = String(product.title || 'PhoneYa2 product').trim();
  const description = String(product.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const categoryNames = {case:'Phone case',charger:'Phone charger',cable:'Charging cable',earphone:'Earphones and headsets',powerbank:'Power bank',protector:'Screen protector',phone:'Phone',watch:'Watch or smartwatch',accessory:'Phone accessory',other:'Accessory'};
  const category = String(product.category || 'other').toLowerCase();
  const guide = categoryGuide(category);
  const price = Number(product.price);
  const stock = Number.parseInt(product.stock, 10);
  const stockText = Number.isFinite(stock) ? (stock > 0 ? 'Listed as in stock' : 'Currently listed as out of stock') : 'Confirm current availability';
  const image = new URL(String(product.image || ''), url.origin).href;
  const priceText = Number.isFinite(price) && price > 0 ? 'ZMW ' + price.toLocaleString('en-ZM') : 'Contact us to confirm the current price';
  const checks = guide.checks.map(item => '<li>' + esc(item) + '</li>').join('');
  return '<article class="py2-seo-product-fallback">'
    + '<nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop.html">Shop</a> / <span>' + esc(title) + '</span></nav>'
    + '<div class="py2-seo-product-layout"><img src="' + esc(image) + '" alt="' + esc(title) + '" loading="eager"><div>'
    + '<p class="py2-seo-kicker">' + esc(categoryNames[category] || 'Phone accessory') + ' · PhoneYa2 Zambia</p>'
    + '<h1>' + esc(title) + '</h1><p class="py2-seo-price">' + esc(priceText) + '</p>'
    + '<p><strong>Availability:</strong> ' + esc(stockText) + '</p>'
    + (description ? '<div class="py2-seo-description"><h2>Product description</h2><p>' + esc(description) + '</p></div>' : '')
    + '<p>Product specifications and availability can change. If an important detail is not stated here, ask before placing an order.</p>'
    + '<p><a class="py2-seo-button" href="/contact.html">Ask about this product</a> <a href="/return-policy.html">Read the return policy</a></p>'
    + '</div></div><section><h2>' + esc(guide.heading) + '</h2><p>' + esc(guide.intro) + '</p><ul>' + checks + '</ul></section>'
    + '<section><h2>How ordering works</h2><ol><li>Review the product description, price and listed availability.</li><li>Ask PhoneYa2 to confirm compatibility or any unclear details.</li><li>Submit your order and wait for confirmation of availability, delivery or collection, and payment arrangements.</li></ol></section>'
    + '<p>For more practical advice and product tips, visit the <a href="/blog.html">PhoneYa2 Blog</a>, or see the <a href="/shop.html">full catalogue</a>.</p>'
    + '</article>';
}

export async function onRequest(context) {
  const request = context.request;
  if (request.method !== 'GET') return context.next();

  const url = new URL(request.url);
  const slug = url.searchParams.get('id');

  // Only handle the existing product.html?id=<slug> route and safe CMS slugs.
  if (!slug || slug.length > 180 || slug === '.' || slug === '..' || /[\/\\\u0000-\u001f]/.test(slug)) {
    return context.next();
  }

  try {
    const productPath = '/content/products/' + encodeURIComponent(slug) + '.md';
    const productResponse = await context.env.ASSETS.fetch(
      new Request(new URL(productPath, url.origin), { method: 'GET' })
    );
    if (!productResponse.ok) return context.next();

    const product = readFrontMatter(await productResponse.text());
    if (!product || !product.title || !product.image) return context.next();

    const assetResponse = await context.env.ASSETS.fetch(
      new Request(new URL('/product.html', url.origin), { method: 'GET', headers: request.headers })
    );
    if (!assetResponse.ok) return assetResponse;

    let html = await assetResponse.text();
    const title = String(product.title).trim();
    const price = String(product.price ?? '').trim();
    const shareTitle = title + (price ? ' – ZMW ' + price : '') + ' | PhoneYa2';
    const description = String(product.description || 'Shop ' + title + ' from PhoneYa2 in Zambia.')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);
    const imageUrl = new URL(String(product.image).trim(), url.origin).href;
    const canonicalUrl = new URL('/product.html?id=' + encodeURIComponent(slug), url.origin).href;

    html = html.replace(/<title\s+id="page-title">[\s\S]*?<\/title>/i,
      '<title id="page-title">' + escapeHtml(shareTitle) + '</title>');
    html = replaceMeta(html, /<meta\s+name="description"\s+id="page-desc"\s+content=(["'])[^"']*\1\s*\/?>/i, description);
    html = replaceMeta(html, /<meta\s+property="og:title"\s+id="og-title"\s+content=(["'])[^"']*\1\s*\/?>/i, shareTitle);
    html = replaceMeta(html, /<meta\s+property="og:description"\s+id="og-desc"\s+content=(["'])[^"']*\1\s*\/?>/i, description);
    html = replaceMeta(html, /<meta\s+property="og:image"\s+id="og-image"\s+content=(["'])[^"']*\1\s*\/?>/i, imageUrl);

    const extraTags = [
      '<meta property="og:url" content="' + escapeHtml(canonicalUrl) + '">',
      '<meta property="og:type" content="product">',
      '<meta name="twitter:title" content="' + escapeHtml(shareTitle) + '">',
      '<meta name="twitter:description" content="' + escapeHtml(description) + '">',
      '<meta name="twitter:image" content="' + escapeHtml(imageUrl) + '">',
      '<link rel="canonical" href="' + escapeHtml(canonicalUrl) + '">'
    ].join('\n');
    if (/<meta\s+name="twitter:card"/i.test(html)) {
      html = html.replace(/(<meta\s+name="twitter:card"[^>]*>)/i, '$1\n' + extraTags);
    } else {
      html = html.replace(/<\/head>/i, extraTags + '\n</head>');
    }

    const structuredProduct = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": title,
      "description": description || title,
      "image": [imageUrl],
      "sku": slug,
      "url": canonicalUrl,
      "brand": { "@type": "Brand", "name": "PhoneYa2" }
    };
    const numericPrice = Number(product.price);
    if (Number.isFinite(numericPrice) && numericPrice > 0) {
      structuredProduct.offers = {
        "@type": "Offer",
        "url": canonicalUrl,
        "priceCurrency": "ZMW",
        "price": numericPrice.toFixed(2),
        "availability": Number(product.stock) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        "seller": { "@type": "Organization", "name": "PhoneYa2", "url": url.origin + "/" }
      };
    }
    const jsonLd = '<script type="application/ld+json" id="py2-server-product-schema">' + JSON.stringify(structuredProduct).replace(/</g, '\\u003c') + '</script>';
    html = html.replace(/<head>/i, '<head>\n<style id="py2-seo-fallback-style">.py2-seo-product-fallback{max-width:1100px;margin:22px auto;padding:20px;color:#172033;background:#fff;border:1px solid #e4e8f0;border-radius:16px;font:16px/1.7 system-ui,sans-serif}.py2-seo-product-fallback a{color:#b84a00}.py2-seo-product-fallback nav{font-size:13px;color:#5d687b;margin-bottom:18px}.py2-seo-product-layout{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:24px;align-items:start}.py2-seo-product-layout>img{width:100%;max-height:420px;object-fit:contain;background:#f7f8fb;border-radius:12px}.py2-seo-kicker{color:#b84a00;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px}.py2-seo-product-fallback h1{font-size:clamp(28px,4vw,42px);line-height:1.15;margin:8px 0}.py2-seo-price{font-size:25px;font-weight:900;color:#e65300}.py2-seo-product-fallback section{border-top:1px solid #e4e8f0;margin-top:24px;padding-top:8px}.py2-seo-product-fallback li{margin:7px 0}.py2-seo-button{display:inline-block;padding:9px 13px;background:#ff6000;color:#fff!important;border-radius:9px;font-weight:800;text-decoration:none}@media(max-width:650px){.py2-seo-product-layout{grid-template-columns:1fr}.py2-seo-product-layout>img{max-height:300px}}</style>\n' + jsonLd + '\n');
    const crawlerContent = renderCrawlerProduct(product, slug, url);
    html = html.replace(/<div class="product-detail" id="product-detail">[\s\S]*?<\/div>\s*<\/div>/i,
      '<div class="product-detail" id="product-detail">' + crawlerContent + '</div>');

    const headers = new Headers(assetResponse.headers);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Cache-Control', 'no-store, max-age=0');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(html, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers
    });
  } catch (error) {
    // Fail open: metadata errors must never take down the existing product page.
    return context.next();
  }
}
