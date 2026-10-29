const DEFAULT_SUPABASE_URL = 'https://signnapmkdctdcfpnsiu.supabase.co';
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_BwOe5fD2oK-hz1LtPNmslw_9EaBZNUD';
const recentSubmissions = new Map();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': 'https://phoneya2.pages.dev',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type',
      'x-content-type-options': 'nosniff'
    }
  });
}

function config(env) {
  return {
    url: String(env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, ''),
    key: String(env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY)
  };
}

async function supabaseRequest(env, path, init = {}) {
  const cfg = config(env);
  return fetch(cfg.url + '/rest/v1/' + path, {
    ...init,
    headers: {
      apikey: cfg.key,
      authorization: 'Bearer ' + cfg.key,
      accept: 'application/json',
      'content-type': 'application/json',
      ...(init.headers || {})
    }
  });
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': 'https://phoneya2.pages.dev',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'Content-Type'
      }
    });
  }

  if (request.method === 'GET') {
    const slug = url.searchParams.get('slug') || '';
    if (!/^[a-z0-9][a-z0-9-]{0,179}$/.test(slug)) {
      return json({ error: 'Invalid post.' }, 400);
    }

    try {
      const query = 'blog_comments?select=commenter,message,submitted_at&post_slug=eq.' +
        encodeURIComponent(slug) + '&status=eq.approved&order=submitted_at.desc&limit=100';
      const response = await supabaseRequest(env, query, { method: 'GET' });
      if (!response.ok) {
        console.error('PhoneYa2 comments read failed', response.status);
        return json({ error: 'Comments are temporarily unavailable.' }, 503);
      }
      const rows = await response.json();
      const comments = (Array.isArray(rows) ? rows : []).map(row => ({
        name: String(row.commenter || 'Reader'),
        message: String(row.message || ''),
        date: String(row.submitted_at || '')
      }));
      return json({ comments });
    } catch (error) {
      console.error('PhoneYa2 comments read failed', String(error));
      return json({ error: 'Comments are temporarily unavailable.' }, 503);
    }
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (request.headers.get('origin') !== 'https://phoneya2.pages.dev') {
    return json({ error: 'Origin not allowed.' }, 403);
  }

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 8000) return json({ error: 'Comment is too long.' }, 413);
    body = JSON.parse(raw);
  } catch (error) {
    return json({ error: 'Invalid submission.' }, 400);
  }

  // Honeypot: silently accept automated submissions without storing them.
  if (body.website) return json({ ok: true, message: 'Thank you for your comment.' }, 201);

  const slug = String(body.post_slug || '');
  const name = String(body.name || '').trim();
  const message = String(body.message || '').trim();

  if (!/^[a-z0-9][a-z0-9-]{0,179}$/.test(slug) ||
      name.length < 2 || name.length > 60 ||
      message.length < 3 || message.length > 1200) {
    return json({ error: 'Please enter a name and a comment between 3 and 1,200 characters.' }, 400);
  }

  try {
    const indexResponse = await env.ASSETS.fetch(new Request(new URL('/content/blog/index.json', url.origin)));
    if (!indexResponse.ok) return json({ error: 'Posts are unavailable.' }, 503);
    const posts = await indexResponse.json();
    if (!Array.isArray(posts) || !posts.some(post => post && post.slug === slug && post.publish === true)) {
      return json({ error: 'This post is unavailable for comments.' }, 404);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const now = Date.now();
    const last = recentSubmissions.get(ip) || 0;
    if (now - last < 60000) {
      return json({ error: 'Please wait a minute before sending another comment.' }, 429);
    }

    if (env.COMMENTS_KV) {
      const key = 'blog-comment-rate:' + ip.replace(/[^a-zA-Z0-9_.:-]/g, '_');
      const count = Number(await env.COMMENTS_KV.get(key) || '0');
      if (count >= 5) return json({ error: 'You have reached the comment limit for now. Please try again later.' }, 429);
      await env.COMMENTS_KV.put(key, String(count + 1), { expirationTtl: 3600 });
    }
    recentSubmissions.set(ip, now);
    if (recentSubmissions.size > 2000) recentSubmissions.clear();

    // RLS allows anonymous inserts only when status is pending. The database
    // generates id, status and submitted_at; clients cannot approve themselves.
    const response = await supabaseRequest(env, 'blog_comments', {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({ post_slug: slug, commenter: name, message: message })
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('PhoneYa2 comment insert failed', response.status, detail.slice(0, 300));
      return json({
        error: response.status === 401 || response.status === 403
          ? 'Comment storage permissions need attention. Please try again later.'
          : 'Your comment could not be saved. Please try again later.'
      }, 502);
    }

    return json({ ok: true, message: 'Thanks! Your comment is saved and will appear after review.' }, 201);
  } catch (error) {
    console.error('PhoneYa2 comment submission failed', String(error));
    return json({ error: 'Your comment could not be saved. Please try again later.' }, 503);
  }
}
