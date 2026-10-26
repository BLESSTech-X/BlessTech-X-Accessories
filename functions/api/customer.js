const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
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

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
async function signRecoveryPayload(payload, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
}
async function verifyRecoveryToken(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !secret) return null;
  const expected = await signRecoveryPayload(parts[0], secret);
  if (expected !== parts[1]) return null;
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(fromBase64url(parts[0]))); } catch { return null; }
  if (!payload.email || !Number.isFinite(payload.exp) || payload.exp < Date.now()) return null;
  return payload;
}
function getCookie(request, name) {
  const prefix = name + "=";
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const item = part.trim();
    if (item.startsWith(prefix)) return item.slice(prefix.length);
  }
  return "";
}
async function createRememberToken(email, secret) {
  const payload = base64url(new TextEncoder().encode(JSON.stringify({
    purpose: "phoneya2_customer_remember",
    email: String(email || "").trim().toLowerCase(),
    exp: Date.now() + 180 * 24 * 60 * 60 * 1000
  })));
  return payload + "." + await signRecoveryPayload(payload, secret);
}
async function verifyRememberToken(token, secret) {
  const payload = await verifyRecoveryToken(token, secret);
  if (!payload || payload.purpose !== "phoneya2_customer_remember") return null;
  const email = String(payload.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return { ...payload, email };
}
async function fetchOrdersForDevice(env, context, email, orderNumbers) {
  const valid = [...new Set(orderNumbers)].filter(value => /^[A-Za-z0-9_-]{3,100}$/.test(value)).slice(-100);
  if (!valid.length) return { customer: { email, name: "" }, orders: [], deviceRecognized: true };
  const query = new URLSearchParams({
    select: "id,order_number,customer_name,customer_email,customer_phone,customer_note,status,total_amount,currency,created_at,order_items(id,product_slug,product_name,quantity,unit_price,line_total)",
    customer_email: "eq." + email,
    order_number: "in.(" + valid.join(",") + ")",
    order: "created_at.desc",
    limit: "100"
  });
  let response = await supabaseFetch(env, "/rest/v1/orders?" + query.toString(), { method: "GET", headers: { accept: "application/json" } });
  if (!response.ok) {
    const fallback = new URLSearchParams(query);
    fallback.delete("customer_note");
    fallback.set("select", "id,order_number,customer_name,customer_email,customer_phone,status,total_amount,currency,created_at,order_items(id,product_slug,product_name,quantity,unit_price,line_total)");
    response = await supabaseFetch(env, "/rest/v1/orders?" + fallback.toString(), { method: "GET", headers: { accept: "application/json" } });
  }
  if (!response.ok) {
    console.error("PhoneYa2 device order query failed:", response.status, (await response.text()).slice(0, 200));
    return null;
  }
  const orders = await response.json();
  return { customer: { email, name: orders[0]?.customer_name || "" }, orders: await addProductImages(context, orders), deviceRecognized: true };
}

async function fetchOrdersForEmail(env, context, email) {
  const buildQuery = includeNote => new URLSearchParams({
    select: "id,order_number,customer_name,customer_email,customer_phone," + (includeNote ? "customer_note," : "") + "status,total_amount,currency,created_at,order_items(id,product_slug,product_name,quantity,unit_price,line_total)",
    customer_email: "eq." + email, order: "created_at.desc", limit: "100"
  });
  let response = await supabaseFetch(env, "/rest/v1/orders?" + buildQuery(true).toString(), { method: "GET", headers: { accept: "application/json" } });
  if (!response.ok) response = await supabaseFetch(env, "/rest/v1/orders?" + buildQuery(false).toString(), { method: "GET", headers: { accept: "application/json" } });
  if (!response.ok) {
    console.error("PhoneYa2 email order recovery query failed:", response.status, (await response.text()).slice(0, 240));
    return null;
  }
  const orders = await response.json();
  return { customer: { email, name: orders[0]?.customer_name || "" }, orders: await addProductImages(context, orders), recovery: true };
}

export async function onRequest(context) {
  const { request, env } = context;
  const base = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const url = new URL(request.url);
  const recoverySecret = getSecret(env, "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
  if (request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Enter the email address used for your PhoneYa2 orders." }, 400); }
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: "Enter a valid order email address." }, 400);
    const apiKey = env.RESEND_API_KEY;
    const from = env.RESEND_FROM;
    if (!base || !recoverySecret || !apiKey || !from) return json({ error: "Email order recovery is temporarily unavailable. Please try again shortly." }, 503);
    try {
      const payload = base64url(new TextEncoder().encode(JSON.stringify({ email, exp: Date.now() + 15 * 60 * 1000 })));
      const signature = await signRecoveryPayload(payload, recoverySecret);
      const link = new URL("/account.html?restore=" + encodeURIComponent(payload + "." + signature), request.url).toString();
      const html = "<div style=\"font-family:Arial,sans-serif;color:#172033;max-width:560px;margin:auto;padding:24px\"><h2 style=\"color:#128c4b\">Restore your PhoneYa2 orders</h2><p>Someone requested access to the order history associated with this email address.</p><p>Tap below to securely restore your orders. This link expires in 15 minutes and does not require a password.</p><p style=\"margin:26px 0\"><a href=\"" + link.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + "\" style=\"display:inline-block;padding:13px 20px;background:#159447;color:white;text-decoration:none;border-radius:9px;font-weight:bold\">Restore my orders</a></p><p>If you did not request this, ignore this email.</p><p>PhoneYa2 Team</p></div>";
      const sent = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: "Bearer " + apiKey, "content-type": "application/json" }, body: JSON.stringify({ from, to: [email], subject: "Restore your PhoneYa2 order history", html }) });
      if (!sent.ok) {
        console.error("PhoneYa2 recovery email failed:", sent.status, (await sent.text()).slice(0, 240));
        return json({ error: "We could not send the recovery email right now. Please try again shortly." }, 502);
      }
      return json({ ok: true, message: "If orders exist for that email, a secure recovery link has been sent. Check your inbox and Spam/Junk folder." });
    } catch (error) {
      console.error("PhoneYa2 email recovery request failed:", String(error).slice(0, 200));
      return json({ error: "Email order recovery is temporarily unavailable. Please try again." }, 503);
    }
  }
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  const recoveryToken = url.searchParams.get("restore") || "";
  if (recoveryToken) {
    const payload = await verifyRecoveryToken(recoveryToken, recoverySecret);
    if (!payload) return json({ error: "This recovery link is invalid or has expired. Request a new email link." }, 401);
    try {
      const email = String(payload.email).trim().toLowerCase();
      const result = await fetchOrdersForEmail(env, context, email);
      if (!result) return json({ error: "We could not retrieve your order history right now. Please try again." }, 503);
      // Only a successful, signed email recovery can establish a remembered device.
      const rememberToken = await createRememberToken(email, recoverySecret);
      return json(result, 200, {
        "set-cookie": "py2_customer_remember=" + rememberToken + "; Max-Age=15552000; Path=/api/customer; HttpOnly; Secure; SameSite=Lax"
      });
    } catch (error) {
      console.error("PhoneYa2 verified order recovery failed:", String(error).slice(0, 200));
      return json({ error: "Order recovery is temporarily unavailable. Please try again." }, 503);
    }
  }
  // First preference: a customer who verified their inbox can load all orders for that email.
  const remembered = await verifyRememberToken(getCookie(request, "py2_customer_remember"), recoverySecret);
  if (remembered) {
    try {
      const result = await fetchOrdersForEmail(env, context, remembered.email);
      if (!result) return json({ error: "We could not load your remembered order history. Please try again." }, 503);
      return json({ ...result, remembered: true });
    } catch (error) {
      console.error("PhoneYa2 remembered customer lookup failed:", String(error).slice(0, 200));
      return json({ error: "Your remembered account is temporarily unavailable." }, 503);
    }
  }
  // Without email verification, return only orders this browser actually placed.
  const device = await verifyDeviceToken(getCookie(request, "py2_device_orders"), recoverySecret);
  if (device) {
    try {
      const result = await fetchOrdersForDevice(env, context, device.email, device.order_numbers);
      if (!result) return json({ error: "We could not refresh orders saved on this device." }, 503);
      return json(result);
    } catch (error) {
      console.error("PhoneYa2 device order lookup failed:", String(error).slice(0, 200));
      return json({ error: "Your saved orders are temporarily unavailable." }, 503);
    }
  }
  const token = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  const anonKey = getSecret(env, "SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY");
  if (!token || !base || !anonKey) return json({ error: "No remembered customer session." }, 401);
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
      "customer_email": "ilike." + email.replace(/[\\%_]/g, ch => "\\" + ch),
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
