function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function enc(value) { return b64url(new TextEncoder().encode(JSON.stringify(value))); }
function pemBytes(pem) {
  const raw = atob(String(pem).replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ""));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
async function googleToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = enc({ alg: "RS256", typ: "JWT" }) + "." + enc({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600
  });
  const key = await crypto.subtle.importKey("pkcs8", pemBytes(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const response = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + b64url(new Uint8Array(sig)) })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error("Google authentication failed. Check the service-account secret and API permissions.");
  return data.access_token;
}
async function report(property, token, body) {
  const r = await fetch("https://analyticsdata.googleapis.com/v1beta/properties/" + encodeURIComponent(property) + ":runReport", {
    method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 403) throw new Error("Google Analytics denied access. Confirm the service account has Viewer access to property " + property + ".");
    if (r.status === 404) throw new Error("GA4 property not found. Check GA4_PROPERTY_ID.");
    throw new Error("Google Analytics report failed. Check the API and Cloudflare settings.");
  }
  return data;
}
function vals(row) { return (row?.metricValues || []).map(v => Number(v.value || 0)); }
export async function onRequest({ request, env }) {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  const token = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  const base = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const anon = env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY;
  const admin = String(env.ADMIN_EMAIL || "singbless89@gmail.com").toLowerCase();
  if (!token || !base || !anon) return json({ error: "Unauthorized." }, 401);
  try {
    const auth = await fetch(base + "/auth/v1/user", { headers: { apikey: anon, authorization: "Bearer " + token } });
    if (!auth.ok) return json({ error: "Unauthorized. Please sign in again." }, 401);
    const user = await auth.json();
    if (String(user.email || "").toLowerCase() !== admin) return json({ error: "Unauthorized." }, 401);
    const property = String(env.GA4_PROPERTY_ID || "").trim();
    if (!/^\d+$/.test(property) || !env.GA4_SERVICE_ACCOUNT_JSON) return json({ error: "GA4_PROPERTY_ID or GA4_SERVICE_ACCOUNT_JSON is missing in Cloudflare." }, 503);
    let sa;
    try { sa = JSON.parse(env.GA4_SERVICE_ACCOUNT_JSON); } catch { return json({ error: "GA4_SERVICE_ACCOUNT_JSON must contain valid JSON." }, 503); }
    const access = await googleToken(sa);
    const range = [{ startDate: "29daysAgo", endDate: "today" }];
    const [summary, daily, sources, pages] = await Promise.all([
      report(property, access, { dateRanges: range, metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }, { name: "eventCount" }] }),
      report(property, access, { dateRanges: range, dimensions: [{ name: "date" }], metrics: [{ name: "sessions" }, { name: "screenPageViews" }], orderBys: [{ dimension: { dimensionName: "date" } }], limit: 30 }),
      report(property, access, { dateRanges: range, dimensions: [{ name: "sessionSourceMedium" }], metrics: [{ name: "sessions" }, { name: "activeUsers" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 8 }),
      report(property, access, { dateRanges: range, dimensions: [{ name: "pagePath" }], metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }], orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: 8 })
    ]);
    const totals = vals(summary.rows?.[0]);
    return json({
      property_id: property, period: "Last 30 days",
      summary: { active_users: totals[0] || 0, sessions: totals[1] || 0, page_views: totals[2] || 0, events: totals[3] || 0 },
      daily: (daily.rows || []).map(r => ({ date: r.dimensionValues?.[0]?.value || "", sessions: vals(r)[0] || 0, page_views: vals(r)[1] || 0 })),
      sources: (sources.rows || []).map(r => ({ source: r.dimensionValues?.[0]?.value || "(not set)", sessions: vals(r)[0] || 0, users: vals(r)[1] || 0 })),
      pages: (pages.rows || []).map(r => ({ path: r.dimensionValues?.[0]?.value || "/", views: vals(r)[0] || 0, users: vals(r)[1] || 0 })),
      generated_at: new Date().toISOString()
    });
  } catch (e) {
    console.error("GA4 endpoint error:", e instanceof Error ? e.message : "unknown error");
    return json({ error: e instanceof Error ? e.message : "Analytics reporting is unavailable." }, 502);
  }
}
