/* Public, aggregate-only PhoneYa2 GA4 summary for the storefront's compact stats strip.
   Does not expose credentials, traffic sources, page paths, or visitor-level data. */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=900",
      "x-content-type-options": "nosniff"
    }
  });
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
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  });
  const key = await crypto.subtle.importKey(
    "pkcs8", pemBytes(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const response = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: unsigned + "." + b64url(new Uint8Array(sig))
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error("Google authentication failed");
  return data.access_token;
}
export async function onRequest({ request, env }) {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  const property = String(env.GA4_PROPERTY_ID || "").trim();
  if (!/^\d+$/.test(property) || !env.GA4_SERVICE_ACCOUNT_JSON) {
    return json({ error: "Analytics is not configured." }, 503);
  }
  try {
    const sa = JSON.parse(env.GA4_SERVICE_ACCOUNT_JSON);
    const token = await googleToken(sa);
    const response = await fetch(
      "https://analyticsdata.googleapis.com/v1beta/properties/" + encodeURIComponent(property) + ":runReport",
      {
        method: "POST",
        headers: { authorization: "Bearer " + token, "content-type": "application/json" },
        body: JSON.stringify({
          dateRanges: [{ startDate: "2020-01-01", endDate: "today" }],
          metrics: [
            { name: "activeUsers" },
            { name: "sessions" },
            { name: "screenPageViews" },
            { name: "eventCount" }
          ]
        })
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Public GA4 summary failed with status", response.status);
      return json({ error: "Analytics is temporarily unavailable." }, 502);
    }
    const values = (data.rows?.[0]?.metricValues || []).map(v => Number(v.value || 0));
    return json({
      period: "All time",
      summary: {
        active_users: values[0] || 0,
        sessions: values[1] || 0,
        page_views: values[2] || 0,
        events: values[3] || 0
      },
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error("Public GA4 summary error:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Analytics is temporarily unavailable." }, 502);
  }
}
