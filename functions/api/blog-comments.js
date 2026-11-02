const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
};
const recentSubmissions = new Map();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
async function requireCommentAdmin(request, env) {
  const { getAdminSession, sameOrigin } = await import("../_auth.js");
  if (!sameOrigin(request)) return null;
  return getAdminSession(request, env);
}
async function rateLimit(env, request) {
  if (!env.DB) throw new Error("PhoneYa2 D1 database binding DB is not configured.");
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  const ipHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  const now = Math.floor(Date.now() / 1000);
  const existing = await env.DB.prepare(
    "SELECT window_started_at, request_count FROM blog_comment_rate_limits WHERE ip_hash = ?"
  ).bind(ipHash).first();
  if (existing && now - Number(existing.window_started_at) < 3600 && Number(existing.request_count) >= 5) {
    return false;
  }
  if (!existing || now - Number(existing.window_started_at) >= 3600) {
    await env.DB.prepare(
      "INSERT INTO blog_comment_rate_limits (ip_hash, window_started_at, request_count) VALUES (?, ?, 1) ON CONFLICT(ip_hash) DO UPDATE SET window_started_at=excluded.window_started_at, request_count=1"
    ).bind(ipHash, now).run();
  } else {
    await env.DB.prepare(
      "UPDATE blog_comment_rate_limits SET request_count=request_count+1 WHERE ip_hash=?"
    ).bind(ipHash).run();
  }
  return true;
}
function validSlug(slug) {
  return /^[a-z0-9][a-z0-9-]{0,179}$/.test(slug);
}
async function publishedPostExists(env, requestUrl, slug) {
  const assetUrl = new URL("/content/blog/index.json", requestUrl);
  const response = env.ASSETS?.fetch
    ? await env.ASSETS.fetch(new Request(assetUrl))
    : await fetch(assetUrl);
  if (!response.ok) throw new Error("Posts are temporarily unavailable.");
  const posts = await response.json();
  return Array.isArray(posts) && posts.some(post => post && post.slug === slug && post.publish === true);
}
export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  if (!env.DB) return json({ error: "PhoneYa2 D1 database binding DB is not configured." }, 503);

  if (request.method === "GET" && url.searchParams.get("admin") === "1") {
    if (!await requireCommentAdmin(request, env)) return json({ error: "Administrator sign-in required." }, 401);
    try {
      const result = await env.DB.prepare(
        "SELECT id, post_slug, commenter, message, submitted_at, status FROM blog_comments ORDER BY submitted_at DESC LIMIT 500"
      ).all();
      return json({ comments: result.results || [] });
    } catch (error) {
      console.error("PhoneYa2 D1 admin comments read failed:", String(error).slice(0, 240));
      return json({ error: "D1 could not read blog comments. Confirm migration 0005_blog_comments.sql has been applied." }, 503);
    }
  }

  if (request.method === "GET") {
    const slug = url.searchParams.get("slug") || "";
    if (!validSlug(slug)) return json({ error: "Invalid post." }, 400);
    try {
      const result = await env.DB.prepare(
        "SELECT commenter, message, submitted_at FROM blog_comments WHERE post_slug=? AND status='approved' ORDER BY submitted_at DESC LIMIT 100"
      ).bind(slug).all();
      return json({ comments: (result.results || []).map(row => ({
        name: String(row.commenter || "Reader"),
        message: String(row.message || ""),
        date: String(row.submitted_at || "")
      })) });
    } catch (error) {
      console.error("PhoneYa2 D1 public comments read failed:", String(error).slice(0, 240));
      return json({ error: "Comments are temporarily unavailable." }, 503);
    }
  }

  if (request.method === "PATCH") {
    if (!await requireCommentAdmin(request, env)) return json({ error: "Administrator sign-in required." }, 401);
    let body;
    try {
      const raw = await request.text();
      if (raw.length > 2000) return json({ error: "Invalid moderation request." }, 413);
      body = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid moderation request." }, 400);
    }
    const id = String(body.id || "").trim();
    const status = String(body.status || "");
    if (!/^[0-9a-fA-F-]{16,50}$/.test(id) || !["pending", "approved", "rejected"].includes(status)) {
      return json({ error: "A valid comment and moderation status are required." }, 400);
    }
    try {
      const result = await env.DB.prepare(
        "UPDATE blog_comments SET status=? WHERE id=? RETURNING id, post_slug, commenter, message, submitted_at, status"
      ).bind(status, id).first();
      if (!result) return json({ error: "Comment not found. Refresh the dashboard and try again." }, 404);
      return json({ ok: true, comment: result });
    } catch (error) {
      console.error("PhoneYa2 D1 comment moderation failed:", String(error).slice(0, 240));
      return json({ error: "D1 could not save the comment status. Confirm migration 0005_blog_comments.sql has been applied." }, 503);
    }
  }

  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) return json({ error: "Origin not allowed." }, 403);
    } catch {
      return json({ error: "Origin not allowed." }, 403);
    }
  }

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 8000) return json({ error: "Comment is too long." }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid submission." }, 400);
  }
  if (body.website) return json({ ok: true, message: "Thank you for your comment." }, 201);

  const slug = String(body.post_slug || "");
  const name = String(body.name || "").trim();
  const message = String(body.message || "").trim();
  if (!validSlug(slug) || name.length < 2 || name.length > 60 || message.length < 3 || message.length > 1200) {
    return json({ error: "Please enter a name and a comment between 3 and 1,200 characters." }, 400);
  }

  try {
    if (!await publishedPostExists(env, request.url, slug)) {
      return json({ error: "This post is unavailable for comments." }, 404);
    }
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const last = recentSubmissions.get(ip) || 0;
    if (Date.now() - last < 60000) return json({ error: "Please wait a minute before sending another comment." }, 429);
    if (!await rateLimit(env, request)) return json({ error: "You have reached the comment limit for now. Please try again later." }, 429);

    const id = crypto.randomUUID();
    const result = await env.DB.prepare(
      "INSERT INTO blog_comments (id, post_slug, commenter, message, status) VALUES (?, ?, ?, ?, 'pending')"
    ).bind(id, slug, name, message).run();
    if (!result.success) throw new Error("D1 insert did not complete.");
    recentSubmissions.set(ip, Date.now());
    if (recentSubmissions.size > 2000) recentSubmissions.clear();
    return json({ ok: true, message: "Thanks! Your comment is saved and will appear after review." }, 201);
  } catch (error) {
    console.error("PhoneYa2 D1 comment submission failed:", String(error).slice(0, 240));
    return json({ error: "Your comment could not be saved. Please try again later." }, 503);
  }
}
