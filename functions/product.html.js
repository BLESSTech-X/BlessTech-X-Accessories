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
      '<meta name="twitter:image" content="' + escapeHtml(imageUrl) + '">'
    ].join('\n');
    if (/<meta\s+name="twitter:card"/i.test(html)) {
      html = html.replace(/(<meta\s+name="twitter:card"[^>]*>)/i, '$1\n' + extraTags);
    } else {
      html = html.replace(/<\/head>/i, extraTags + '\n</head>');
    }

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
