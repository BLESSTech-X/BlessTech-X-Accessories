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
async function sendOrderNtfy(env, order, customer = {}, items = []) {
  const topic = String(env.NTFY_TOPIC || "").trim();
  if (!topic || !/^[A-Za-z0-9_-]{16,128}$/.test(topic)) return false;
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
  const response = await fetch("https://ntfy.sh/" + encodeURIComponent(topic), {
    method: "POST",
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "title": "New PhoneYa2 order",
      "priority": "high",
      "tags": "shopping_bags"
    },
    body: details
  });
  return response.ok;
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
async function sendOrderEmail(env, order, customer, items) {
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM;
  const to = env.ORDER_NOTIFY_EMAIL || "singbless89@gmail.com";
  if (!apiKey || !from) return false;
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
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "New PhoneYa2 order " + order.order_number,
      html
    })
  });
  return response.ok;
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
      let notificationSent = false;
      if (env.NTFY_TOPIC) {
        try { notificationSent = await sendOrderNtfy(env, order, { name, email, phone, note }, items); }
        catch (error) { console.error("PhoneYa2 ntfy notification failed:", String(error)); }
        if (!notificationSent) console.error("Order saved but ntfy notification was not sent for", order.order_number);
      } else {
        try { notificationSent = await sendOrderEmail(env, order, { name, email, phone, address, note }, items); }
        catch (error) { console.error("PhoneYa2 order email failed:", String(error)); }
        if (!notificationSent) console.error("Order saved but notification email was not sent for", order.order_number);
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
        const sent = await sendOrderNtfy(env, { order_number: "TEST", total_amount: 0 });
        if (!sent) return json({ error: "ntfy test failed. Check that NTFY_TOPIC is set correctly and the topic name matches your subscription." }, 502);
        return json({ success: true, message: "Test notification sent to ntfy." });
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
      const response = await supabaseFetch(env,
        "/rest/v1/orders?id=eq." + encodeURIComponent(id),
        { method: "PATCH", headers: { prefer: "return=representation" },
          body: JSON.stringify({ status, updated_at: new Date().toISOString() }) }
      );
      if (!response.ok) throw new Error("Order status update failed: " + response.status);
      const updated = await response.json();
      if (!updated.length) return json({ error: "Order not found." }, 404);
      return json({ success: true, order: updated[0] });
    } catch (error) {
      console.error("PhoneYa2 admin order action failed:", String(error));
      return json({ error: "Could not complete the request. Please try again." }, 503);
    }
  }

  return json({ error: "Method not allowed." }, 405);
}
