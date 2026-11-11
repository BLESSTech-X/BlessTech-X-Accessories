const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const ALLOWED_STATUSES = new Set(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]);
const MAX_LINES = 30;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
}
function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
}
function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}
function getSecret(env, ...keys) {
  for (const key of keys) if (env[key]) return env[key];
  return "";
}
function readCookie(request, name) {
  const prefix = name + "=";
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const item = part.trim();
    if (item.startsWith(prefix)) return item.slice(prefix.length);
  }
  return "";
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
async function signDevicePayload(payload, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
}
async function verifyDeviceToken(token, secrets) {
  const parts = String(token || "").split(".");
  const keys = (Array.isArray(secrets) ? secrets : [secrets]).filter(Boolean);
  if (parts.length !== 2 || !keys.length) return null;
  let valid = false;
  for (const secret of keys) {
    try { if (await signDevicePayload(parts[0], secret) === parts[1]) { valid = true; break; } } catch {}
  }
  if (!valid) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(parts[0])));
    if (payload.purpose !== "phoneya2_device_orders" || !payload.email ||
        !Number.isFinite(payload.exp) || payload.exp < Date.now() ||
        !Array.isArray(payload.order_numbers)) return null;
    return {
      email: String(payload.email).trim().toLowerCase(),
      order_numbers: [...new Set(payload.order_numbers.map(String).filter(x => /^[A-Za-z0-9_-]{3,100}$/.test(x)))].slice(-100),
      exp: payload.exp
    };
  } catch { return null; }
}
async function createDeviceToken(email, orderNumbers, secret) {
  const payload = base64url(new TextEncoder().encode(JSON.stringify({
    purpose: "phoneya2_device_orders",
    email: String(email || "").trim().toLowerCase(),
    order_numbers: [...new Set(orderNumbers.map(String))].slice(-100),
    exp: Date.now() + 180 * 24 * 60 * 60 * 1000
  })));
  return payload + "." + await signDevicePayload(payload, secret);
}

function parseProductMarkdown(markdown, slug) {
  const front = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!front) return null;
  const scalar = key => {
    const match = front[1].match(new RegExp("^" + key + ":\\s*(.*?)\\s*$", "m"));
    if (!match) return "";
    return match[1].trim().replace(/^["']|["']$/g, "");
  };
  const title = scalar("title");
  const price = Number(scalar("price"));
  const stock = Number(scalar("stock"));
  if (!title || !Number.isFinite(price) || price < 0 || !Number.isFinite(stock)) return null;
  const image = scalar("image");
  return { slug, title, price: Math.round(price * 100) / 100, stock: Math.max(0, Math.floor(stock)), image: image.startsWith("/") && !image.startsWith("//") ? image : "" };
}
async function fetchStaticAsset(context, path) {
  const url = new URL(path, context.request.url);
  // Use the platform's static asset binding when available to avoid a network
  // loopback request to the same site; retain a same-origin fallback.
  if (context.env.ASSETS && typeof context.env.ASSETS.fetch === "function") {
    const response = await context.env.ASSETS.fetch(new Request(url.toString(), { headers: { accept: "*/*" } }));
    if (response.status !== 404) return response;
  }
  return fetch(url);
}
async function loadProduct(context, slug) {
  if (!/^[\p{L}\p{N}\p{M}\p{S}][\p{L}\p{N}\p{M}\p{S}-]{0,100}$/u.test(slug)) return null;
  const indexResponse = await fetchStaticAsset(context, "/content/products/index.json");
  if (!indexResponse.ok) throw new Error("Product catalog is temporarily unavailable.");
  const slugs = await indexResponse.json();
  if (!Array.isArray(slugs) || !slugs.includes(slug)) return null;
  const response = await fetchStaticAsset(context, "/content/products/" + slug + ".md");
  if (!response.ok) return null;
  return parseProductMarkdown(await response.text(), slug);
}
async function requireAdmin(request, env) {
  const { getAdminSession } = await import("../_auth.js");
  return getAdminSession(request, env);
}

function moneyToMinor(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error("Invalid order amount.");
  return Math.round((number + Number.EPSILON) * 100);
}
function minorToMoney(value) {
  return Number(value || 0) / 100;
}
function mapD1Order(row, items = []) {
  return {
    id: row.id,
    order_number: row.order_number,
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    customer_phone: row.customer_phone,
    delivery_address: row.delivery_address,
    customer_note: row.customer_note || "",
    status: row.status,
    total_amount: minorToMoney(row.total_amount_minor),
    currency: row.currency || "ZMW",
    created_at: row.created_at,
    updated_at: row.updated_at,
    order_items: items.map(item => ({
      id: item.id,
      order_id: item.order_id,
      product_slug: item.product_slug,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: minorToMoney(item.unit_price_minor),
      line_total: minorToMoney(item.line_total_minor)
    }))
  };
}
async function createD1Order(env, customer, items, attribution = {}) {
  if (!env.DB) throw new Error("PhoneYa2 D1 database binding DB is not configured.");
  const id = crypto.randomUUID();
  const orderNumber = "PY2-" + new Date().toISOString().slice(0,10).replace(/-/g,"") + "-" + crypto.randomUUID().slice(0,8).toUpperCase();
  const totalMinor = items.reduce((sum, item) => sum + moneyToMinor(item.line_total), 0);
  let fulfilmentSource = "phoneya2", fulfilmentAgentId = "";
  const reservations = [];
  // If this referred agent has enough allocated stock for every line, reserve it for agent-managed fulfilment.
  if (attribution.agent_code) {
    try {
      let complete = true;
      for (const item of items) {
        const stock = await env.DB.prepare("SELECT id,ownership FROM agent_inventory WHERE agent_id=? AND product_slug=? AND quantity>=? ORDER BY CASE ownership WHEN 'agent' THEN 0 ELSE 1 END LIMIT 1")
          .bind(attribution.agent_code, item.product_slug, item.quantity).first();
        if (!stock) { complete = false; break; }
        reservations.push({id:stock.id,slug:item.product_slug,quantity:item.quantity,ownership:stock.ownership});
      }
      if (complete && reservations.length === items.length) {
        const results = await env.DB.batch(reservations.map(x => env.DB.prepare("UPDATE agent_inventory SET quantity=quantity-?,updated_at=? WHERE id=? AND quantity>=?")
          .bind(x.quantity,new Date().toISOString(),x.id,x.quantity)));
        if (results.every(x => Number(x.meta?.changes||0)===1)) {
          const kinds = [...new Set(reservations.map(x=>x.ownership))];
          fulfilmentSource = kinds.length>1 ? "agent_stock_mixed" : kinds[0]==="agent" ? "agent_stock_agent_owned" : "agent_stock_phoneya2";
          fulfilmentAgentId = attribution.agent_code;
        } else {
          const succeeded = reservations.filter((x,i)=>Number(results[i]?.meta?.changes||0)===1);
          if(succeeded.length)await env.DB.batch(succeeded.map(x => env.DB.prepare("UPDATE agent_inventory SET quantity=quantity+?,updated_at=? WHERE id=?")
            .bind(x.quantity,new Date().toISOString(),x.id)));
          reservations.length = 0;
        }
      } else reservations.length = 0;
    } catch (error) {
      if (!/no such table: agent_inventory/i.test(String(error))) console.error("Agent stock reservation skipped:",String(error).slice(0,220));
      reservations.length = 0;
    }
  }
  const now = new Date().toISOString();
  const itemsStatements = () => items.map(item => env.DB.prepare("INSERT INTO order_items (id, order_id, product_slug, product_name, quantity, unit_price_minor, line_total_minor) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), id, item.product_slug, item.product_name, item.quantity, moneyToMinor(item.unit_price), moneyToMinor(item.line_total)));
  const movementStatements = reservations.map(x => env.DB.prepare("INSERT INTO agent_inventory_movements(id,agent_id,product_slug,quantity_delta,movement_type,reference,actor) VALUES(?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),attribution.agent_code,x.slug,-x.quantity,"order_reservation",orderNumber,"checkout:"+x.ownership));
  const full = [
    env.DB.prepare("INSERT INTO orders (id, order_number, customer_name, customer_email, customer_phone, delivery_address, customer_note, status, total_amount_minor, currency, agent_code, agent_referral_code, agent_attribution_source, agent_attributed_at, fulfilment_source, fulfilment_agent_id, fulfilment_status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'ZMW', ?, ?, ?, ?, ?, ?, ?)")
      .bind(id,orderNumber,customer.name,customer.email,customer.phone,customer.address,customer.note||"",totalMinor,attribution.agent_code||"",attribution.referral_code||"",attribution.source||"",attribution.agent_code?now:null,fulfilmentSource,fulfilmentAgentId,fulfilmentAgentId?"assigned":"central"),
    ...itemsStatements(), ...movementStatements
  ];
  try {
    await env.DB.batch(full);
  } catch (error) {
    try {
      if (/no such column: fulfilment_status/i.test(String(error))) {
        const withFulfilment = [
          env.DB.prepare("INSERT INTO orders (id, order_number, customer_name, customer_email, customer_phone, delivery_address, customer_note, status, total_amount_minor, currency, agent_code, agent_referral_code, agent_attribution_source, agent_attributed_at, fulfilment_source, fulfilment_agent_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'ZMW', ?, ?, ?, ?, ?, ?)")
            .bind(id,orderNumber,customer.name,customer.email,customer.phone,customer.address,customer.note||"",totalMinor,attribution.agent_code||"",attribution.referral_code||"",attribution.source||"",attribution.agent_code?now:null,fulfilmentSource,fulfilmentAgentId),
          ...itemsStatements(), ...movementStatements
        ];
        await env.DB.batch(withFulfilment);
      } else if (/no such column: fulfilment_(?:source|agent_id)/i.test(String(error))) {
        const withAgent = [
          env.DB.prepare("INSERT INTO orders (id, order_number, customer_name, customer_email, customer_phone, delivery_address, customer_note, status, total_amount_minor, currency, agent_code, agent_referral_code, agent_attribution_source, agent_attributed_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'ZMW', ?, ?, ?, ?)")
            .bind(id,orderNumber,customer.name,customer.email,customer.phone,customer.address,customer.note||"",totalMinor,attribution.agent_code||"",attribution.referral_code||"",attribution.source||"",attribution.agent_code?now:null),
          ...itemsStatements(), ...movementStatements
        ];
        await env.DB.batch(withAgent);
      } else if (/no such column: agent_(?:code|referral_code|attribution_source|attributed_at)/i.test(String(error))) {
        const legacy = [
          env.DB.prepare("INSERT INTO orders (id, order_number, customer_name, customer_email, customer_phone, delivery_address, customer_note, status, total_amount_minor, currency) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'ZMW')")
            .bind(id,orderNumber,customer.name,customer.email,customer.phone,customer.address,customer.note||"",totalMinor),
          ...itemsStatements()
        ];
        await env.DB.batch(legacy);
        fulfilmentSource = "phoneya2"; fulfilmentAgentId = "";
      } else throw error;
    } catch (fallbackError) {
      if (reservations.length) {
        try { await env.DB.batch(reservations.map(x=>env.DB.prepare("UPDATE agent_inventory SET quantity=quantity+?,updated_at=? WHERE id=?").bind(x.quantity,new Date().toISOString(),x.id))); } catch {}
      }
      throw fallbackError;
    }
  }
  try {
    await env.DB.prepare("INSERT OR IGNORE INTO admin_notifications (id,event_key,category,event_type,title,message,priority,destination,related_id,related_label) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(),"order:"+id,"orders","new_order","New order received","Order "+orderNumber+" is awaiting review. Total: ZMW "+minorToMoney(totalMinor).toFixed(2)+".","high","/admin/orders.html",id,orderNumber).run();
  } catch (error) {
    console.error("PhoneYa2 order notification could not be recorded:",String(error).slice(0,220));
  }
  return { id, order_number: orderNumber, total_amount: minorToMoney(totalMinor), currency: "ZMW", item_count: items.length, fulfilment_source: fulfilmentSource, fulfilment_agent_id: fulfilmentAgentId };
}
async function readD1Orders(env, options = {}) {
  if (!env.DB) throw new Error("PhoneYa2 D1 database binding DB is not configured.");
  const limit = Math.min(200, Math.max(1, Number(options.limit) || 100));
  let rows;
  if (options.orderNumbers?.length) {
    const valid = [...new Set(options.orderNumbers)].filter(value => /^[A-Za-z0-9_-]{3,100}$/.test(value)).slice(-100);
    if (!valid.length) return [];
    const placeholders = valid.map(() => "?").join(",");
    rows = await env.DB.prepare("SELECT * FROM orders WHERE lower(customer_email)=lower(?) AND order_number IN (" + placeholders + ") ORDER BY created_at DESC LIMIT ?")
      .bind(options.email || "", ...valid, limit).all();
  } else if (options.email) {
    rows = await env.DB.prepare("SELECT * FROM orders WHERE lower(customer_email)=lower(?) ORDER BY created_at DESC LIMIT ?")
      .bind(options.email, limit).all();
  } else {
    rows = await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT ?").bind(limit).all();
  }
  const orders = rows.results || [];
  if (!orders.length) return [];
  const ids = orders.map(row => row.id);
  const itemPlaceholders = ids.map(() => "?").join(",");
  const itemRows = await env.DB.prepare("SELECT * FROM order_items WHERE order_id IN (" + itemPlaceholders + ") ORDER BY rowid ASC")
    .bind(...ids).all();
  const byOrder = new Map();
  for (const item of itemRows.results || []) {
    if (!byOrder.has(item.order_id)) byOrder.set(item.order_id, []);
    byOrder.get(item.order_id).push(item);
  }
  return orders.map(row => mapD1Order(row, byOrder.get(row.id) || []));
}

async function logEmailActivity(env, record) {
  try {
    if (!env.DB) throw new Error("D1 database binding DB is not configured.");
    const activityId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO email_activity (id,event_type,source,trigger_source,recipient_email,recipient_name,subject,status,provider,provider_message_id,error_message,related_order_number,related_product_slug,retry_count,sent_at,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)")
      .bind(
        activityId, record.eventType || "transactional", record.source || "automatic",
        record.triggerSource || "", String(record.recipientEmail || "").slice(0,254),
        String(record.recipientName || "").slice(0,120), String(record.subject || "").slice(0,300),
        record.status || "failed", record.provider || "brevo", record.providerMessageId || "",
        String(record.error || "").slice(0,1000), record.orderNumber || "", record.productSlug || "",
        record.status === "sent" ? new Date().toISOString() : null,
        JSON.stringify(record.metadata || {})
      ).run();
    if (record.status === "failed") {
      try {
        const eventKey="email-failure:"+activityId;
        await env.DB.prepare("INSERT OR IGNORE INTO admin_notifications (id,event_key,category,event_type,title,message,priority,destination,related_id,related_label) VALUES (?,?,?,?,?,?,?,?,?,?)")
          .bind(crypto.randomUUID(),eventKey,"communications","email_failed","Email delivery failed",String(record.subject||"An email could not be delivered.")+(record.error?" — "+String(record.error).slice(0,220):""),"high","/admin/communications.html",activityId,String(record.subject||"Email").slice(0,120)).run();
      } catch (notificationError) {
        console.error("PhoneYa2 email notification could not be recorded:",String(notificationError).slice(0,220));
      }
    }
    return true;
  } catch (error) {
    console.error("PhoneYa2 D1 email activity logging failed:", String(error).slice(0,240));
    return false;
  }
}
async function sendOrderNtfy(env, order, customer = {}, items = []) {
  const topic = String(env.NTFY_TOPIC || "").trim();
  if (!topic) return { ok: false, reason: "NTFY_TOPIC is missing from this Cloudflare deployment." };
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(topic)) {
    return { ok: false, reason: "NTFY_TOPIC has an invalid format. Enter only the topic name, not a URL." };
  }
  const itemSummary = items.slice(0, 5).map(item =>
    String(item.product_name || item.title || "Product") + " x" + Number(item.quantity || 1)
  ).join(", ");
  const details = [
    "Order: " + String(order.order_number || "received"),
    "Customer: " + String(customer.name || "Not provided"),
    "Phone/WhatsApp: " + String(customer.phone || "Not provided"),
    "Email: " + String(customer.email || "Not provided"),
    itemSummary ? "Items: " + itemSummary : "",
    customer.note ? "Customer note: " + String(customer.note).slice(0, 1000) : "",
    "Total: ZMW " + Number(order.total_amount || 0).toFixed(2),
    "Status: Pending",
    "Review in the PhoneYa2 admin dashboard."
  ].filter(Boolean).join("\n");
  let response;
  try {
    response = await fetch("https://ntfy.sh/" + encodeURIComponent(topic), {
      method: "POST",
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "title": "New PhoneYa2 order",
        "priority": "high",
        "tags": "shopping_bags"
      },
      body: details
    });
  } catch (error) {
    return { ok: false, reason: "Could not reach ntfy.sh: " + String(error).slice(0, 160) };
  }
  if (!response.ok) {
    return { ok: false, reason: "ntfy.sh returned HTTP " + response.status + "." };
  }
  return { ok: true, reason: "" };
}
async function sendOrderTelegram(env, order, customer = {}, items = []) {
  const token = String(env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = String(env.TELEGRAM_CHAT_ID || "").trim();
  if (!token || !chatId) return { ok: false, reason: "Telegram is not configured." };
  const itemSummary = items.slice(0, 8).map(item =>
    String(item.product_name || item.title || "Product") + " x" + Number(item.quantity || 1)
  ).join("\n");
  const text = [
    "🛍️ NEW PHONEYA2 ORDER",
    "Order: " + String(order.order_number || "received"),
    "Customer: " + String(customer.name || "Not provided"),
    "Phone/WhatsApp: " + String(customer.phone || "Not provided"),
    "Email: " + String(customer.email || "Not provided"),
    customer.address ? "Delivery address: " + String(customer.address) : "",
    itemSummary ? "Items:\n" + itemSummary : "",
    customer.note ? "Customer note: " + String(customer.note).slice(0, 500) : "",
    "Total: ZMW " + Number(order.total_amount || 0).toFixed(2),
    "Status: Pending",
    "Review in the PhoneYa2 admin dashboard."
  ].filter(Boolean).join("\n");
  try {
    const response = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
    });
    if (!response.ok) return { ok: false, reason: "Telegram API returned HTTP " + response.status + "." };
    const result = await response.json();
    return result.ok ? { ok: true, reason: "" } : { ok: false, reason: "Telegram API rejected the message." };
  } catch (error) {
    return { ok: false, reason: "Could not reach Telegram API: " + String(error).slice(0, 120) };
  }
}

async function sendBrevoEmail(env,to,subject,html){
  const key=env.BREVO_API_KEY,fromEmail=env.BREVO_FROM_EMAIL;
  if(!key||!fromEmail)return{ok:false,error:"Brevo email is not configured. Add BREVO_API_KEY and BREVO_FROM_EMAIL in Cloudflare Pages secrets."};
  try{
    const response=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":key,"content-type":"application/json","accept":"application/json"},body:JSON.stringify({
      sender:{name:env.BREVO_FROM_NAME||"PhoneYa2 Accessories",email:fromEmail},
      to:[{email:to}],subject,htmlContent:html
    })});
    const result=await response.json().catch(()=>({}));
    return response.ok?{ok:true,providerMessageId:result.messageId||""}:{ok:false,error:"Brevo returned HTTP "+response.status+": "+String(result.message||result.code||"").slice(0,240)};
  }catch(error){return{ok:false,error:String(error).slice(0,240)};}
}
function normalizeZambiaPhone(value){
  let digits=String(value||"").replace(/\D/g,"");
  if(digits.startsWith("0"))digits="260"+digits.slice(1);
  return digits.startsWith("260")?digits:"";
}
async function sendBrevoSms(env,phone,content,tag){
  const key=env.BREVO_API_KEY,sender=String(env.BREVO_SMS_SENDER||"PhoneYa2").trim(),recipient=normalizeZambiaPhone(phone);
  if(!key||!recipient)return{ok:false,skipped:true,error:!key?"Brevo SMS is not configured.":"Phone number is not a valid Zambian mobile number."};
  if(!/^[A-Za-z0-9]{1,11}$/.test(sender))return{ok:false,skipped:true,error:"BREVO_SMS_SENDER must be an approved sender ID of up to 11 letters or numbers."};
  try{
    const response=await fetch("https://api.brevo.com/v3/transactionalSMS/send",{method:"POST",headers:{"api-key":key,"content-type":"application/json","accept":"application/json"},body:JSON.stringify({sender,recipient,content:String(content||"").slice(0,450),type:"transactional",tag:tag||"phoneya2_order_update"})});
    const result=await response.json().catch(()=>({}));
    return response.ok?{ok:true,messageId:String(result.messageId||"")}:{ok:false,error:"Brevo SMS returned HTTP "+response.status+": "+String(result.message||result.code||"").slice(0,180)};
  }catch(error){return{ok:false,error:String(error).slice(0,180)};}
}
async function logCommunicationActivity(env,record){
  if(!env.DB)return;
  try{await env.DB.prepare("INSERT INTO communication_activity(id,campaign_id,recipient,recipient_name,channel,event_type,status,provider,provider_message_id,error_message) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),record.campaignId||"",record.recipient||"",record.name||"",record.channel||"sms",record.eventType||"order_notification",record.status||"failed","brevo",record.messageId||"",String(record.error||"").slice(0,500)).run();}
  catch(error){console.error("PhoneYa2 communication activity log failed:",String(error).slice(0,180));}
}

async function sendOrderEmail(env, order, customer, items) {
  const apiKey = env.BREVO_API_KEY;
  const from = env.BREVO_FROM_EMAIL;
  const to = env.ORDER_NOTIFY_EMAIL || "singbless89@gmail.com";
  if (!apiKey || !from) return { ok: false, error: "Brevo API key or sender is not configured." };
  const rows = items.map(item =>
    "<tr><td style=\"padding:8px;border-bottom:1px solid #eee\">" + escapeHtml(item.product_name) +
    "</td><td style=\"padding:8px;border-bottom:1px solid #eee;text-align:center\">" + item.quantity +
    "</td><td style=\"padding:8px;border-bottom:1px solid #eee;text-align:right\">ZMW " + Number(item.line_total).toFixed(2) + "</td></tr>"
  ).join("");
  const html = "<div style=\"font-family:Arial,sans-serif;color:#222;max-width:640px;margin:auto\">" +
    "<h2>New PhoneYa2 order: " + escapeHtml(order.order_number) + "</h2>" +
    "<p><b>Customer:</b> " + escapeHtml(customer.name) + "</p>" +
    "<p><b>Email:</b> " + escapeHtml(customer.email) + "</p>" +
    "<p><b>Phone:</b> " + escapeHtml(customer.phone) + "</p>" +
    "<p><b>Delivery address:</b> " + escapeHtml(customer.address) + "</p>" +
    (customer.note ? "<p><b>Customer note / specifications:</b><br>" + escapeHtml(customer.note).replace(/\n/g, "<br>") + "</p>" : "") +
    "<table style=\"width:100%;border-collapse:collapse\"><thead><tr><th align=\"left\">Product</th><th>Qty</th><th align=\"right\">Line total</th></tr></thead><tbody>" + rows + "</tbody></table>" +
    "<h3 style=\"text-align:right\">Total: ZMW " + Number(order.total_amount).toFixed(2) + "</h3>" +
    "<p>Status: Pending</p></div>";
  return await sendBrevoEmail(env,to,"New PhoneYa2 order " + order.order_number,html);}
async function sendOrderFormspree(env, order, customer = {}, items = []) {
  const endpoint = "https://formspree.io/f/mdeabqwq";
  const itemSummary = items.slice(0, 30).map(item =>
    String(item.product_name || item.title || "Product") + " x" + Number(item.quantity || 1) +
    " — ZMW " + Number(item.line_total || 0).toFixed(2)
  ).join("\n");
  const payload = {
    _subject: "New PhoneYa2 order " + String(order.order_number || ""),
    order_number: String(order.order_number || ""),
    customer_name: String(customer.name || ""),
    customer_email: String(customer.email || ""),
    customer_phone: String(customer.phone || ""),
    delivery_address: String(customer.address || ""),
    customer_note: String(customer.note || "").slice(0, 1000),
    items: itemSummary,
    order_total: "ZMW " + Number(order.total_amount || 0).toFixed(2),
    order_status: "Pending",
    source: "PhoneYa2 checkout"
  };
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "accept": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: "Formspree returned HTTP " + response.status + ": " + String(result.error || result.errors?.map?.(item => item.message).join("; ") || "").slice(0, 240) };
    }
    return { ok: true, providerMessageId: "" };
  } catch (error) {
    return { ok: false, error: "Formspree request failed: " + String(error).slice(0, 200) };
  }
}

async function sendCustomerOrderConfirmation(env, order, customer, items) {
  const apiKey = env.BREVO_API_KEY;
  const from = env.BREVO_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false, error: "Brevo API key or sender is not configured." };
  if (!customer.email) return { ok: false, error: "Customer email is missing." };
  const rows = items.map(item =>
    "<tr><td style=\"padding:10px;border-bottom:1px solid #e9edf3\">" + escapeHtml(item.product_name) +
    "</td><td style=\"padding:10px;border-bottom:1px solid #e9edf3;text-align:center\">" + Number(item.quantity) +
    "</td><td style=\"padding:10px;border-bottom:1px solid #e9edf3;text-align:right\">ZMW " + Number(item.line_total).toFixed(2) + "</td></tr>"
  ).join("");
  const html = "<div style=\"font-family:Arial,sans-serif;color:#18202b;max-width:640px;margin:auto;line-height:1.55\">" +
    "<div style=\"background:#151827;color:#fff;padding:22px;border-radius:14px 14px 0 0\"><div style=\"font-size:12px;letter-spacing:2px;color:#ff8b45;font-weight:bold\">PHONEYA2 ACCESSORIES</div><h1 style=\"font-size:24px;margin:8px 0 0\">We received your order!</h1></div>" +
    "<div style=\"padding:22px;border:1px solid #e7eaf0;border-top:0;border-radius:0 0 14px 14px\">" +
    "<p>Hello " + escapeHtml(customer.name || "there") + ",</p><p>Thank you for shopping with PhoneYa2. Your order has been saved and is currently <strong>pending confirmation</strong>. We will contact you using the details you provided.</p>" +
    "<div style=\"background:#fff5ee;padding:14px;border-radius:10px;margin:18px 0\"><div style=\"font-size:12px;color:#8a4b24\">YOUR ORDER NUMBER</div><strong style=\"font-size:20px\">" + escapeHtml(order.order_number) + "</strong></div>" +
    "<table style=\"width:100%;border-collapse:collapse\"><thead><tr><th align=\"left\" style=\"padding:8px 10px\">Product</th><th style=\"padding:8px\">Qty</th><th align=\"right\" style=\"padding:8px 10px\">Line total</th></tr></thead><tbody>" + rows + "</tbody></table>" +
    "<h2 style=\"text-align:right;font-size:20px\">Total: ZMW " + Number(order.total_amount).toFixed(2) + "</h2>" +
    "<p><strong>Delivery address:</strong><br>" + escapeHtml(customer.address) + "</p>" +
    (customer.note ? "<p><strong>Your note:</strong><br>" + escapeHtml(customer.note).replace(/\n/g, "<br>") + "</p>" : "") +
    "<p>If you need help, reply to this email or contact PhoneYa2 using the contact details on our website.</p><p>Thank you,<br><strong>PhoneYa2 Team</strong></p>" +
    "</div></div>";
  return await sendBrevoEmail(env,customer.email,"We received your PhoneYa2 order " + order.order_number,html);}

async function sendOrderStatusEmail(env,order){
  const email=cleanText(order.customer_email,254).toLowerCase();
  if(!email)return{ok:false,error:"Customer email is missing."};
  const status=String(order.status||"").toLowerCase();
  const labels={confirmed:"confirmed",processing:"being prepared",shipped:"on its way",delivered:"delivered",cancelled:"cancelled"};
  const label=labels[status]||status;
  const orderNumber=cleanText(order.order_number,80);
  const name=cleanText(order.customer_name,120)||"there";
  const feedback=status==="delivered"?"<p>We'd appreciate your honest feedback about the product and delivery experience. Sharing feedback is completely optional.</p><p><a href='https://wa.me/260979603741?text="+encodeURIComponent("Hi PhoneYa2, my order "+orderNumber+" has been delivered. I'd like to share feedback.")+"' style='display:inline-block;background:#128c7e;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold'>Share feedback on WhatsApp</a></p>":"";
  const html="<div style='font-family:Arial,sans-serif;color:#18202b;max-width:620px;margin:auto;line-height:1.6'><div style='background:#151827;color:#fff;padding:22px;border-radius:14px 14px 0 0'><div style='font-size:12px;letter-spacing:2px;color:#ff8b45;font-weight:bold'>PHONEYA2 ACCESSORIES</div><h1 style='font-size:24px;margin:8px 0 0'>Your order update</h1></div><div style='padding:22px;border:1px solid #e7eaf0;border-top:0;border-radius:0 0 14px 14px'><p>Hello "+escapeHtml(name)+",</p><p>Your PhoneYa2 order <strong>"+escapeHtml(orderNumber)+"</strong> is now <strong>"+escapeHtml(label)+"</strong>.</p><p>We'll keep you informed if anything else changes. If you need help, contact the PhoneYa2 team.</p>"+feedback+"<p>Thank you,<br><strong>PhoneYa2 Team</strong></p></div></div>";
  return await sendBrevoEmail(env,email,"PhoneYa2 order "+orderNumber+" — "+label+" update",html);
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: "Cross-origin request blocked." }, 403);
  const url = new URL(request.url);

  if (request.method === "POST" && !url.searchParams.has("admin")) {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Please submit valid order details." }, 400); }
    const name = cleanText(body.name, 120);
    const email = cleanText(body.email, 254).toLowerCase();
    const phone = cleanText(body.phone, 40);
    const address = cleanText(body.address, 500);
    const note = cleanText(body.note, 1000);
    const submittedReferral = cleanText(body.agent_referral_code, 40);
    const agentReferralCode = /^[A-Za-z0-9_-]{3,40}$/.test(submittedReferral) ? submittedReferral.toUpperCase() : "";
    // A referral is eligible for 30 days from the recorded click. Only active approved agents qualify.
    let agentAttribution = { agent_code: "", referral_code: "", source: "" };
    const capturedAt = Date.parse(cleanText(body.agent_referral_captured_at, 50));
    const attributionDaysRow = await env.DB.prepare("SELECT setting_value FROM agent_commission_settings WHERE setting_key='referral_attribution_days'").first().catch(()=>null);
    const attributionDays = Math.max(1, Math.min(180, Number(attributionDaysRow?.setting_value || 30)));
    const freshReferral = Number.isFinite(capturedAt) && capturedAt <= Date.now() + 300000 && Date.now() - capturedAt <= attributionDays * 86400000;
    if (agentReferralCode && freshReferral && env.DB) {
      try {
        const attributedAgent = await env.DB.prepare("SELECT agent_id,email,phone FROM agent_accounts WHERE referral_code=? AND status='active'").bind(agentReferralCode).first();
        const customerPhoneDigits = phone.replace(/\\D/g,""), agentPhoneDigits = String(attributedAgent?.phone||"").replace(/\\D/g,"");
        const selfReferral = attributedAgent && (String(attributedAgent.email||"").toLowerCase()===email || (agentPhoneDigits.length>=7 && agentPhoneDigits===customerPhoneDigits));
        if (attributedAgent && !selfReferral) agentAttribution = { agent_code: attributedAgent.agent_id, referral_code: agentReferralCode, source: "referral_link" };
      } catch (error) {
        // Older D1 environments can still process normal checkout until the Agent Network migrations are applied.
        if (!/no such table: agent_accounts/i.test(String(error))) throw error;
      }
    }
    const storedNote = note;
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        phone.length < 7 || address.length < 5) {
      return json({ error: "Please complete your name, valid email, phone number and delivery address." }, 400);
    }
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_LINES) {
      return json({ error: "Add between 1 and 30 different product lines." }, 400);
    }
    try {
      const quantities = new Map();
      for (const item of body.items) {
        const slug = cleanText(item?.slug, 101);
        const quantity = Number(item?.quantity);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
          return json({ error: "Each product quantity must be between 1 and 99." }, 400);
        }
        quantities.set(slug, (quantities.get(slug) || 0) + quantity);
      }
      if (quantities.size > MAX_LINES) return json({ error: "Too many product lines." }, 400);

      const items = [];
      for (const [slug, quantity] of quantities) {
        const product = await loadProduct(context, slug);
        if (!product) return json({ error: "A selected product could not be found. Please refresh the shop and try again." }, 400);
        if (product.stock < quantity) {
          let agentHeld = 0;
          if (agentAttribution.agent_code) {
            try { const held = await env.DB.prepare("SELECT COALESCE(SUM(quantity),0) quantity FROM agent_inventory WHERE agent_id=? AND product_slug=?").bind(agentAttribution.agent_code,slug).first(); agentHeld = Number(held?.quantity||0); } catch {}
          }
          if (agentHeld < quantity) return json({ error: product.title + " has only " + (product.stock+agentHeld) + " eligible unit(s) available for this referral." }, 400);
        }
        const unitPrice = product.price;
        items.push({
          product_slug: slug,
          product_name: product.title,
          quantity,
          unit_price: unitPrice,
          line_total: Math.round(unitPrice * quantity * 100) / 100
        });
      }

      let order;
      try {
        order = await createD1Order(env, { name, email, phone, address, note: storedNote }, items, agentAttribution);
      } catch (error) {
        console.error("PhoneYa2 D1 order save failed:", String(error).slice(0,500));
        return json({ error: "We could not save your order just now. Your order was not confirmed; please try again." }, 502);
      }
      // Customer accounts use password-free device recognition and email recovery; no external auth invitation is required.
      const accountInvited = false;
      const orderCustomer = { name, email, phone, address, note };
      // Attempt app push (Telegram) and email independently so either can alert the owner.
      let telegramSent = false;
      let emailSent = false;
      try {
        const result = await sendOrderTelegram(env, order, orderCustomer, items);
        telegramSent = result.ok;
        if (!result.ok && result.reason !== "Telegram is not configured.") {
          console.error("PhoneYa2 Telegram notification failed for", order.order_number, result.reason);
        }
      } catch (error) {
        console.error("PhoneYa2 Telegram notification failed:", String(error));
      }
      let ownerEmailResult = { ok: false, error: "Email notification was not attempted." };
      try {
        ownerEmailResult = await sendOrderEmail(env, order, orderCustomer, items);
        emailSent = ownerEmailResult.ok;
      } catch (error) {
        ownerEmailResult = { ok: false, error: String(error).slice(0, 240) };
        console.error("PhoneYa2 order email failed:", String(error));
      }
      let formspreeResult = { ok: false, error: "Formspree alert was not attempted." };
      try {
        formspreeResult = await sendOrderFormspree(env, order, orderCustomer, items);
        if (!formspreeResult.ok) console.error("PhoneYa2 Formspree order alert failed for", order.order_number, formspreeResult.error);
      } catch (error) {
        formspreeResult = { ok: false, error: String(error).slice(0, 240) };
        console.error("PhoneYa2 Formspree order alert failed:", String(error));
      }
      await logEmailActivity(env, {
        eventType: "new_order_alert", source: "automatic", triggerSource: "order_created",
        recipientEmail: env.ORDER_NOTIFY_EMAIL || "singbless89@gmail.com", recipientName: "PhoneYa2 store owner",
        subject: "New PhoneYa2 order " + order.order_number,
        status: emailSent || formspreeResult.ok ? "sent" : "failed",
        provider: emailSent && formspreeResult.ok ? "brevo+formspree" : formspreeResult.ok ? "formspree" : "brevo",
        providerMessageId: ownerEmailResult.providerMessageId || "",
        error: [ownerEmailResult.error, formspreeResult.error].filter(Boolean).join(" | "),
        orderNumber: order.order_number,
        metadata: { orderTotal: Number(order.total_amount || 0), itemCount: items.length, brevoSent: emailSent, formspreeSent: formspreeResult.ok }
      });

      let customerEmailResult = { ok: false, error: "Customer confirmation was not attempted." };
      try {
        customerEmailResult = await sendCustomerOrderConfirmation(env, order, orderCustomer, items);
      } catch (error) {
        customerEmailResult = { ok: false, error: String(error).slice(0, 240) };
        console.error("PhoneYa2 customer order confirmation failed:", String(error));
      }
      const customerSmsResult=await sendBrevoSms(env,orderCustomer.phone,"PhoneYa2: We received your order "+order.order_number+". Total ZMW "+Number(order.total_amount||0).toFixed(2)+". We will contact you to confirm it.","phoneya2_order_confirmation");
      await logCommunicationActivity(env,{recipient:normalizeZambiaPhone(orderCustomer.phone),name:orderCustomer.name,channel:"sms",eventType:"order_confirmation",status:customerSmsResult.ok?"sent":customerSmsResult.skipped?"skipped":"failed",messageId:customerSmsResult.messageId,error:customerSmsResult.error});
      await logEmailActivity(env, {
        eventType: "order_confirmation", source: "automatic", triggerSource: "order_created",
        recipientEmail: orderCustomer.email, recipientName: orderCustomer.name,
        subject: "We received your PhoneYa2 order " + order.order_number,
        status: customerEmailResult.ok ? "sent" : "failed",
        providerMessageId: customerEmailResult.providerMessageId || "", error: customerEmailResult.error || "",
        orderNumber: order.order_number, metadata: { orderTotal: Number(order.total_amount || 0), itemCount: items.length }
      });

      const notificationSent = telegramSent || emailSent || formspreeResult.ok;
      if (!telegramSent && !emailSent && !formspreeResult.ok) {
        console.error("Order saved but both Telegram and email notifications failed for", order.order_number);
      }
      // Remember only order numbers actually created on this browser. This lets
      // the account page restore device orders automatically without exposing
      // every order associated with a merely typed email address.
      const rememberSecret = getSecret(env, "PHONEYA2_ADMIN_PASSWORD");
      const orderNumber = String(order.order_number || "");
      let deviceCookie = "";
      if (rememberSecret && orderNumber) {
        try {
          const prior = await verifyDeviceToken(readCookie(request, "py2_device_orders"), [rememberSecret]);
          const knownNumbers = prior && prior.email === email ? prior.order_numbers : [];
          const token = await createDeviceToken(email, [...knownNumbers, orderNumber], rememberSecret);
          deviceCookie = "py2_device_orders=" + token + "; Max-Age=15552000; Path=/api/; HttpOnly; Secure; SameSite=Lax";
        } catch (error) {
          console.error("PhoneYa2 device recognition cookie could not be created:", String(error).slice(0, 160));
        }
      }
      return json({
        success: true,
        order_number: order.order_number,
        total_amount: order.total_amount,
        currency: "ZMW",
        notification_sent: notificationSent,
        account_invited: accountInvited
      }, 201, deviceCookie ? { "set-cookie": deviceCookie } : {});
    } catch (error) {
      console.error("PhoneYa2 order submission failed:", String(error));
      return json({ error: "Ordering is temporarily unavailable. Please try again shortly." }, 503);
    }
  }

  if (url.searchParams.get("admin") === "1" && (request.method === "GET" || request.method === "PATCH" || request.method === "POST")) {
    const user = await requireAdmin(request, env);
    if (!user) return json({ error: "Administrator sign-in required." }, 401);
    try {
      if (request.method === "POST") {
        const testOrder = { order_number: "TEST", total_amount: 0 };
        const testCustomer = { name: "PhoneYa2 notification test", email: "", phone: "", address: "Admin test only", note: "Internal notification test." };
        let telegramSent = false;
        let emailSent = false;
        let telegramReason = "Telegram is not configured.";
        try {
          const result = await sendOrderTelegram(env, testOrder, testCustomer, []);
          telegramSent = result.ok;
          telegramReason = result.reason || "";
        } catch (error) {
          telegramReason = String(error).slice(0, 140);
        }
        let testEmailResult = { ok: false, error: "Email test was not attempted." };
        try {
          testEmailResult = await sendOrderEmail(env, testOrder, testCustomer, []);
          emailSent = testEmailResult.ok;
        } catch (error) {
          testEmailResult = { ok: false, error: String(error).slice(0, 240) };
          console.error("PhoneYa2 notification test email failed:", String(error));
        }
        await logEmailActivity(env, {
          eventType: "notification_test", source: "manual", triggerSource: "admin_test_button",
          recipientEmail: env.ORDER_NOTIFY_EMAIL || "singbless89@gmail.com", recipientName: "PhoneYa2 store owner",
          subject: "New PhoneYa2 order TEST", status: emailSent ? "sent" : "failed",
          providerMessageId: testEmailResult.providerMessageId || "", error: testEmailResult.error || "",
          orderNumber: "TEST", metadata: { test: true }
        });
        const outcomes = [];
        outcomes.push(telegramSent ? "Telegram app notification sent." : "Telegram failed: " + telegramReason);
        outcomes.push(emailSent ? "Test email sent to ORDER_NOTIFY_EMAIL." : "Email failed; check BREVO_API_KEY, BREVO_FROM_EMAIL, and ORDER_NOTIFY_EMAIL.");
        if (telegramSent || emailSent) return json({ success: true, message: outcomes.join(" ") });
        return json({ error: outcomes.join(" ") }, 502);
      }
      if (request.method === "GET") {
        const orders = await readD1Orders(env, { limit: 200 });
        const slugs = [...new Set(orders.flatMap(order => (order.order_items || []).map(item => item.product_slug).filter(Boolean)))];
        const productMap = new Map();
        await Promise.all(slugs.map(async slug => { try { const product = await loadProduct(context, slug); if (product) productMap.set(slug, product); } catch {} }));
        const enriched = orders.map(order => ({ ...order, order_items: (order.order_items || []).map(item => ({ ...item, product_image: productMap.get(item.product_slug)?.image || "" })) }));
        return json({ orders: enriched });
      }
      let body;
      try { body = await request.json(); } catch { return json({ error: "Invalid update." }, 400); }
      const id = cleanText(body.id, 40);
      const status = cleanText(body.status, 20);
      if (!/^[0-9a-f-]{36}$/i.test(id) || !ALLOWED_STATUSES.has(status)) {
        return json({ error: "Invalid order or status." }, 400);
      }
      if (!env.DB) throw new Error("PhoneYa2 D1 database binding DB is not configured.");
      const currentRow = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
      if (!currentRow) return json({ error: "Order not found." }, 404);
      await env.DB.prepare("UPDATE orders SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").bind(status, id).run();
      if (status === "cancelled" && currentRow.status !== "cancelled") {
        try { await reverseAgentCommissionForCancelledOrder(env.DB,currentRow); } catch (commissionError) { console.error("Agent commission reversal failed:",String(commissionError).slice(0,220)); }
      }
      // Restore agent-held units exactly once when an order is cancelled before delivery.
      if (status === "cancelled" && currentRow.status !== "delivered" && currentRow.fulfilment_agent_id && String(currentRow.fulfilment_source||"").startsWith("agent_stock")) {
        try {
          const existingRestore = await env.DB.prepare("SELECT id FROM agent_inventory_movements WHERE reference=? AND movement_type='order_cancel_restore' LIMIT 1").bind(currentRow.order_number).first();
          if (!existingRestore) {
            const reservations = await env.DB.prepare("SELECT product_slug,quantity_delta,actor FROM agent_inventory_movements WHERE reference=? AND movement_type='order_reservation' AND agent_id=?").bind(currentRow.order_number,currentRow.fulfilment_agent_id).all();
            const restoreStatements = [];
            for (const movement of (reservations.results||[])) {
              const quantity = Math.abs(Number(movement.quantity_delta||0));
              const ownership = String(movement.actor||"").split(":")[1] || "phoneya2";
              if (!quantity) continue;
              restoreStatements.push(env.DB.prepare("INSERT INTO agent_inventory(id,agent_id,product_slug,quantity,ownership,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(agent_id,product_slug,ownership) DO UPDATE SET quantity=quantity+excluded.quantity,updated_at=excluded.updated_at").bind(crypto.randomUUID(),currentRow.fulfilment_agent_id,movement.product_slug,quantity,ownership,new Date().toISOString()));
              restoreStatements.push(env.DB.prepare("INSERT INTO agent_inventory_movements(id,agent_id,product_slug,quantity_delta,movement_type,reference,actor) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),currentRow.fulfilment_agent_id,movement.product_slug,quantity,"order_cancel_restore",currentRow.order_number,"system"));
            }
            if (restoreStatements.length) await env.DB.batch(restoreStatements);
          }
        } catch (inventoryError) { console.error("Agent inventory cancellation restore failed:",String(inventoryError).slice(0,220)); }
      }
      const updatedRows = await readD1Orders(env, { limit: 200 });
      const updatedOrder = updatedRows.find(order => order.id === id);
      if (!updatedOrder) return json({ error: "Order not found." }, 404);
      let statusEmailSent = false, statusSmsSent = false;
      if (currentRow.status !== status) {
        const statusEmail = await sendOrderStatusEmail(env, updatedOrder);
        statusEmailSent = statusEmail.ok;
        const statusLabel = String(status||"").replace(/_/g," ");
        const statusSms = await sendBrevoSms(env,updatedOrder.customer_phone,"PhoneYa2: Your order "+(updatedOrder.order_number||"")+" status is now "+statusLabel+". Contact us if you need help.","phoneya2_order_status");
        statusSmsSent = statusSms.ok;
        await logCommunicationActivity(env,{recipient:normalizeZambiaPhone(updatedOrder.customer_phone),name:updatedOrder.customer_name,channel:"sms",eventType:"order_status_update",status:statusSms.ok?"sent":statusSms.skipped?"skipped":"failed",messageId:statusSms.messageId,error:statusSms.error});
        await logEmailActivity(env, {
          eventType: "order_status_update", source: "automatic", triggerSource: "order_status_changed",
          recipientEmail: updatedOrder.customer_email || "", recipientName: updatedOrder.customer_name || "",
          subject: "PhoneYa2 order " + (updatedOrder.order_number || "") + " — " + statusLabel + " update",
          status: statusEmail.ok ? "sent" : "failed",
          provider: "brevo", providerMessageId: statusEmail.providerMessageId || "", error: statusEmail.error || "",
          orderNumber: updatedOrder.order_number || "", metadata: { orderStatus: status }
        });
        if (!statusEmail.ok) console.error("PhoneYa2 order status email failed for", updatedOrder.order_number, statusEmail.error);
      }
      return json({ success: true, order: updatedOrder, status_email_sent: statusEmailSent, status_sms_sent: statusSmsSent });
    } catch (error) {
      console.error("PhoneYa2 admin order action failed:", String(error));
      return json({ error: "Could not complete the request. Please try again." }, 503);
    }
  }

  return json({ error: "Method not allowed." }, 405);
}
