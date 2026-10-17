const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const ALLOWED_STATUSES = new Set(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]);
const MAX_LINES = 30;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
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
  if (!/^[a-z0-9][a-z0-9-]{0,100}$/.test(slug)) return null;
  const indexResponse = await fetchStaticAsset(context, "/content/products/index.json");
  if (!indexResponse.ok) throw new Error("Product catalog is temporarily unavailable.");
  const slugs = await indexResponse.json();
  if (!Array.isArray(slugs) || !slugs.includes(slug)) return null;
  const response = await fetchStaticAsset(context, "/content/products/" + slug + ".md");
  if (!response.ok) return null;
  return parseProductMarkdown(await response.text(), slug);
}
async function requireAdmin(request, env) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const base = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = getSecret(env, "SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY");
  const adminEmail = String(env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (!token || !base || !anonKey || !adminEmail) return null;
  const response = await fetch(base + "/auth/v1/user", {
    headers: { apikey: anonKey, authorization: "Bearer " + token }
  });
  if (!response.ok) return null;
  const user = await response.json();
  if (!user?.email || String(user.email).toLowerCase() !== adminEmail) return null;
  return user;
}
async function logEmailActivity(env, record) {
  try {
    const response = await supabaseFetch(env, "/rest/v1/email_activity", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        event_type: record.eventType || "transactional",
        source: record.source || "automatic",
        trigger_source: record.triggerSource || "",
        recipient_email: String(record.recipientEmail || "").slice(0, 254),
        recipient_name: String(record.recipientName || "").slice(0, 120),
        subject: String(record.subject || "").slice(0, 300),
        status: record.status || "failed",
        provider: record.provider || "resend",
        provider_message_id: record.providerMessageId || "",
        error_message: String(record.error || "").slice(0, 1000),
        related_order_number: record.orderNumber || "",
        related_product_slug: record.productSlug || "",
        retry_count: 0,
        sent_at: record.status === "sent" ? new Date().toISOString() : null,
        metadata: record.metadata || {}
      })
    });
    if (!response.ok) {
      console.error("PhoneYa2 email activity log write failed:", response.status, (await response.text()).slice(0, 240));
      return false;
    }
    return true;
  } catch (error) {
    console.error("PhoneYa2 email activity logging failed:", String(error).slice(0, 240));
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
async function inviteCustomerAccount(env, email, name) {
  const base = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = getSecret(env, "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
  if (!base || !key) return false;
  const redirect = "https://phoneya2.pages.dev/account.html";
  const response = await fetch(base + "/auth/v1/invite?redirect_to=" + encodeURIComponent(redirect), {
    method: "POST",
    headers: { apikey: key, authorization: "Bearer " + key, "content-type": "application/json" },
    body: JSON.stringify({ email, data: { full_name: name, name } })
  });
  if (response.ok) return true;
  const detail = await response.text();
  // Existing auth accounts are expected for repeat customers; their order still saves.
  if (response.status !== 422 && response.status !== 400) {
    console.error("PhoneYa2 customer invite failed:", response.status, detail.slice(0, 250));
  }
  return false;
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
async function sendOrderEmail(env, order, customer, items) {
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM;
  const to = env.ORDER_NOTIFY_EMAIL || "singbless89@gmail.com";
  if (!apiKey || !from) return { ok: false, error: "Resend API key or sender is not configured." };
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
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: "Bearer " + apiKey, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: "New PhoneYa2 order " + order.order_number, html })
    });
    const result = await response.json().catch(() => ({}));
    return response.ok
      ? { ok: true, providerMessageId: result.id || "" }
      : { ok: false, error: "Resend returned HTTP " + response.status + ": " + String(result.message || result.name || "").slice(0, 240) };
  } catch (error) {
    return { ok: false, error: String(error).slice(0, 240) };
  }
}
async function sendOrderFormspree(env, order, customer = {}, items = []) {
  const endpoint = "https://formspree.io/f/mbgdwnab";
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
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM;
  if (!apiKey || !from) return { ok: false, error: "Resend API key or sender is not configured." };
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
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: "Bearer " + apiKey, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [customer.email], subject: "We received your PhoneYa2 order " + order.order_number, html })
    });
    const result = await response.json().catch(() => ({}));
    return response.ok
      ? { ok: true, providerMessageId: result.id || "" }
      : { ok: false, error: "Resend returned HTTP " + response.status + ": " + String(result.message || result.name || "").slice(0, 240) };
  } catch (error) {
    return { ok: false, error: String(error).slice(0, 240) };
  }
}

async function sendDeliveredOrderEmail(env, order) {
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM;
  const email = cleanText(order.customer_email, 254).toLowerCase();
  if (!apiKey || !from) return { ok: false, error: "Resend API key or sender is not configured." };
  if (!email) return { ok: false, error: "Customer email is missing." };
  const orderNumber = cleanText(order.order_number, 80);
  const name = cleanText(order.customer_name, 120) || "there";
  const feedbackUrl = "https://wa.me/260979603741?text=" + encodeURIComponent(
    "Hi PhoneYa2, my order " + orderNumber + " has been delivered. I'd like to share honest feedback about my experience."
  );
  const html = "<div style=\"font-family:Arial,sans-serif;color:#18202b;max-width:620px;margin:auto;line-height:1.6\">" +
    "<div style=\"background:#151827;color:#fff;padding:22px;border-radius:14px 14px 0 0\"><div style=\"font-size:12px;letter-spacing:2px;color:#ff8b45;font-weight:bold\">PHONEYA2 ACCESSORIES</div><h1 style=\"font-size:24px;margin:8px 0 0\">Your order has been delivered</h1></div>" +
    "<div style=\"padding:22px;border:1px solid #e7eaf0;border-top:0;border-radius:0 0 14px 14px\">" +
    "<p>Hello " + escapeHtml(name) + ",</p><p>Our records show that your PhoneYa2 order <strong>" + escapeHtml(orderNumber) + "</strong> has been marked as delivered. Thank you for shopping with us.</p>" +
    "<p>We'd appreciate your honest feedback about the product and delivery experience. Your feedback helps us improve; sharing it is completely optional.</p>" +
    "<p style=\"margin:24px 0\"><a href=\"" + escapeHtml(feedbackUrl) + "\" style=\"display:inline-block;background:#128c7e;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold\">Share feedback on WhatsApp</a></p>" +
    "<p>If you have not received your order, please contact us so we can investigate.</p><p>Thank you,<br><strong>PhoneYa2 Team</strong></p></div></div>";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: "Bearer " + apiKey, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [email], subject: "PhoneYa2 order " + orderNumber + " — delivery update", html })
    });
    const result = await response.json().catch(() => ({}));
    return response.ok
      ? { ok: true, providerMessageId: result.id || "" }
      : { ok: false, error: "Resend returned HTTP " + response.status + ": " + String(result.message || result.name || "").slice(0, 240) };
  } catch (error) {
    return { ok: false, error: String(error).slice(0, 240) };
  }
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
        if (product.stock < quantity) return json({ error: product.title + " has only " + product.stock + " in stock." }, 400);
        const unitPrice = product.price;
        items.push({
          product_slug: slug,
          product_name: product.title,
          quantity,
          unit_price: unitPrice,
          line_total: Math.round(unitPrice * quantity * 100) / 100
        });
      }

      let rpc = await supabaseFetch(env, "/rest/v1/rpc/create_phoneya2_order", {
        method: "POST",
        body: JSON.stringify({
          p_customer_name: name,
          p_customer_email: email,
          p_customer_phone: phone,
          p_delivery_address: address,
          p_items: items,
          p_customer_note: note
        })
      });
      if (!rpc.ok && !note) {
        // Keep ordinary checkout working until the database note migration is applied.
        rpc = await supabaseFetch(env, "/rest/v1/rpc/create_phoneya2_order", {
          method: "POST",
          body: JSON.stringify({ p_customer_name: name, p_customer_email: email, p_customer_phone: phone, p_delivery_address: address, p_items: items })
        });
      }
      if (!rpc.ok) {
        const detail = await rpc.text();
        console.error("PhoneYa2 order RPC failed:", rpc.status, detail.slice(0, 500));
        return json({ error: note ? "Order notes are being enabled. Please try again shortly, or remove the note and submit the order." : "We could not save your order just now. Your order was not confirmed; please try again." }, 502);
      }
      const order = await rpc.json();
      // Customer orders are saved first; account invitations are best-effort and
      // must never cause a successful order to fail. Existing accounts are left alone.
      let accountInvited = false;
      try { accountInvited = await inviteCustomerAccount(env, email, name); }
      catch (error) { console.error("PhoneYa2 customer invitation failed:", String(error)); }
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
        provider: emailSent && formspreeResult.ok ? "resend+formspree" : formspreeResult.ok ? "formspree" : "resend",
        providerMessageId: ownerEmailResult.providerMessageId || "",
        error: [ownerEmailResult.error, formspreeResult.error].filter(Boolean).join(" | "),
        orderNumber: order.order_number,
        metadata: { orderTotal: Number(order.total_amount || 0), itemCount: items.length, resendSent: emailSent, formspreeSent: formspreeResult.ok }
      });

      let customerEmailResult = { ok: false, error: "Customer confirmation was not attempted." };
      try {
        customerEmailResult = await sendCustomerOrderConfirmation(env, order, orderCustomer, items);
      } catch (error) {
        customerEmailResult = { ok: false, error: String(error).slice(0, 240) };
        console.error("PhoneYa2 customer order confirmation failed:", String(error));
      }
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
      return json({
        success: true,
        order_number: order.order_number,
        total_amount: order.total_amount,
        currency: "ZMW",
        notification_sent: notificationSent,
        account_invited: accountInvited
      }, 201);
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
        outcomes.push(emailSent ? "Test email sent to ORDER_NOTIFY_EMAIL." : "Email failed; check RESEND_API_KEY, RESEND_FROM, and ORDER_NOTIFY_EMAIL.");
        if (telegramSent || emailSent) return json({ success: true, message: outcomes.join(" ") });
        return json({ error: outcomes.join(" ") }, 502);
      }
      if (request.method === "GET") {
        const response = await supabaseFetch(env,
          "/rest/v1/orders?select=*,order_items(*)&order=created_at.desc&limit=200",
          { method: "GET", headers: { accept: "application/json" } }
        );
        if (!response.ok) throw new Error("Order list request failed: " + response.status);
        const orders = await response.json();
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
      const currentResponse = await supabaseFetch(env,
        "/rest/v1/orders?id=eq." + encodeURIComponent(id) + "&select=id,status,order_number,customer_name,customer_email",
        { method: "GET", headers: { accept: "application/json" } }
      );
      if (!currentResponse.ok) throw new Error("Could not verify the current order status: " + currentResponse.status);
      const currentRows = await currentResponse.json();
      if (!currentRows.length) return json({ error: "Order not found." }, 404);
      const currentOrder = currentRows[0];
      const response = await supabaseFetch(env,
        "/rest/v1/orders?id=eq." + encodeURIComponent(id),
        { method: "PATCH", headers: { prefer: "return=representation" },
          body: JSON.stringify({ status, updated_at: new Date().toISOString() }) }
      );
      if (!response.ok) throw new Error("Order status update failed: " + response.status);
      const updated = await response.json();
      if (!updated.length) return json({ error: "Order not found." }, 404);
      let deliveryEmailSent = false;
      if (status === "delivered" && currentOrder.status !== "delivered") {
        const deliveryEmail = await sendDeliveredOrderEmail(env, updated[0]);
        deliveryEmailSent = deliveryEmail.ok;
        await logEmailActivity(env, {
          eventType: "delivery_update", source: "automatic", triggerSource: "order_marked_delivered",
          recipientEmail: updated[0].customer_email || "", recipientName: updated[0].customer_name || "",
          subject: "PhoneYa2 order " + (updated[0].order_number || "") + " — delivery update",
          status: deliveryEmail.ok ? "sent" : "failed",
          providerMessageId: deliveryEmail.providerMessageId || "", error: deliveryEmail.error || "",
          orderNumber: updated[0].order_number || "", metadata: { orderStatus: "delivered" }
        });
        if (!deliveryEmail.ok) console.error("PhoneYa2 delivery email failed for", updated[0].order_number, deliveryEmail.error);
      }
      return json({ success: true, order: updated[0], delivery_email_sent: deliveryEmailSent });
    } catch (error) {
      console.error("PhoneYa2 admin order action failed:", String(error));
      return json({ error: "Could not complete the request. Please try again." }, 503);
    }
  }

  return json({ error: "Method not allowed." }, 405);
}
