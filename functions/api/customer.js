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
async function fetchStaticAsset(context, path) {
  const url = new URL(path, context.request.url);
  if (context.env.ASSETS && typeof context.env.ASSETS.fetch === "function") {
    const response = await context.env.ASSETS.fetch(new Request(url.toString(), { headers: { accept: "*/*" } }));
    if (response.status !== 404) return response;
  }
  return fetch(url);
}
function readProductImage(markdown) {
  const front = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!front) return "";
  const match = front[1].match(/^image:\s*(.*?)\s*$/m);
  if (!match) return "";
  const value = match[1].trim().replace(/^["']|["']$/g, "");
  return value.startsWith("/") && !value.startsWith("//") ? value : "";
}
async function addProductImages(context, orders) {
  const slugs = [...new Set(orders.flatMap(order => (order.order_items || []).map(item => item.product_slug).filter(Boolean)))];
  const images = new Map();
  await Promise.all(slugs.map(async slug => {
    if (!/^[a-z0-9][a-z0-9-]{0,100}$/.test(slug)) return;
    try {
      const response = await fetchStaticAsset(context, "/content/products/" + slug + ".md");
      if (response.ok) images.set(slug, readProductImage(await response.text()));
    } catch {}
  }));
  return orders.map(order => ({ ...order, order_items: (order.order_items || []).map(item => ({ ...item, product_image: images.get(item.product_slug) || "" })) }));
}
export async function onRequest(context) {
  const { request, env } = context;
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
    const buildQuery = includeNote => new URLSearchParams({
      select: "id,order_number,customer_name,customer_email,customer_phone,delivery_address," + (includeNote ? "customer_note," : "") + "status,total_amount,currency,created_at,order_items(id,product_slug,product_name,quantity,unit_price,line_total)",
      "customer_email": "eq." + email,
      order: "created_at.desc",
      limit: "100"
    });
    let response = await supabaseFetch(env, "/rest/v1/orders?" + buildQuery(true).toString(), { method: "GET", headers: { accept: "application/json" } });
    let noteSupport = true;
    if (!response.ok) {
      response = await supabaseFetch(env, "/rest/v1/orders?" + buildQuery(false).toString(), { method: "GET", headers: { accept: "application/json" } });
      noteSupport = false;
    }
    if (!response.ok) {
      console.error("Customer order history query failed:", response.status, (await response.text()).slice(0, 300));
      return json({ error: "We could not load your order history. Please try again." }, 503);
    }
    const orders = await response.json();
    return json({ customer: { id: user.id, email, name: user.user_metadata?.full_name || user.user_metadata?.name || "" }, orders: await addProductImages(context, orders), note_support: noteSupport });
  } catch (error) {
    console.error("PhoneYa2 customer endpoint failed:", String(error));
    return json({ error: "Your account service is temporarily unavailable." }, 503);
  }
}
