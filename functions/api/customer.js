const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
function getSecret(env, ...keys) {
  for (const key of keys) if (env[key]) return env[key];
  return "";
}
async function supabaseFetch(env, path, init = {}) {
  const base = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = getSecret(env, "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
  if (!base || !key) throw new Error("Server database secrets are not configured.");
  const headers = new Headers(init.headers || {});
  headers.set("apikey", key);
  headers.set("authorization", "Bearer " + key);
  headers.set("content-type", "application/json");
  return fetch(base + path, { ...init, headers });
}
export async function onRequest({ request, env }) {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  const token = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  const base = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = getSecret(env, "SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY");
  if (!token || !base || !anonKey) return json({ error: "Please sign in to view your orders." }, 401);
  try {
    const userResponse = await fetch(base + "/auth/v1/user", {
      headers: { apikey: anonKey, authorization: "Bearer " + token }
    });
    if (!userResponse.ok) return json({ error: "Your session has expired. Please sign in again." }, 401);
    const user = await userResponse.json();
    const email = String(user.email || "").trim().toLowerCase();
    if (!email || !user.email_confirmed_at) {
      return json({ error: "Please verify your email address before viewing your order history." }, 403);
    }
    const query = new URLSearchParams({
      select: "id,order_number,customer_name,customer_email,customer_phone,delivery_address,status,total_amount,currency,created_at,order_items(id,product_slug,product_name,quantity,unit_price,line_total)",
      "customer_email": "eq." + email,
      order: "created_at.desc",
      limit: "100"
    });
    const response = await supabaseFetch(env, "/rest/v1/orders?" + query.toString(), {
      method: "GET", headers: { accept: "application/json" }
    });
    if (!response.ok) {
      console.error("Customer order history query failed:", response.status, (await response.text()).slice(0, 300));
      return json({ error: "We could not load your order history. Please try again." }, 503);
    }
    return json({ customer: { id: user.id, email, name: user.user_metadata?.full_name || user.user_metadata?.name || "" }, orders: await response.json() });
  } catch (error) {
    console.error("PhoneYa2 customer endpoint failed:", String(error));
    return json({ error: "Your account service is temporarily unavailable." }, 503);
  }
}
