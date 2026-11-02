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
async function requireAdmin(request, env) {
  const { getAdminSession, sameOrigin } = await import("../_auth.js");
  if (!sameOrigin(request)) return null;
  return await getAdminSession(request, env);
}
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  const url = new URL(request.url);
  if (url.searchParams.get("admin") !== "1") return json({ error: "Not found." }, 404);
  if (!await requireAdmin(request, env)) return json({ error: "Administrator sign-in required." }, 401);
  try {
    const [statsResponse, activityResponse, subscriberResponse, automationResponse] = await Promise.all([
      supabaseFetch(env, "/rest/v1/rpc/phoneya2_email_stats", { method: "POST", body: "{}" }),
      supabaseFetch(env, "/rest/v1/email_activity?select=id,created_at,sent_at,event_type,source,trigger_source,recipient_email,recipient_name,subject,status,provider,provider_message_id,error_message,related_order_number,related_product_slug,campaign_id,retry_count,metadata&order=created_at.desc&limit=250", { method: "GET", headers: { accept: "application/json" } }),
      supabaseFetch(env, "/rest/v1/customer_subscribers?select=id,status&limit=1000", { method: "GET", headers: { accept: "application/json" } }),
      supabaseFetch(env, "/rest/v1/communication_automations?select=automation_key,name,description,enabled,approval_required,updated_at&order=name.asc", { method: "GET", headers: { accept: "application/json" } })
    ]);
    if (!statsResponse.ok || !activityResponse.ok || !subscriberResponse.ok || !automationResponse.ok) {
      const statuses = [statsResponse.status, activityResponse.status, subscriberResponse.status, automationResponse.status];
      console.error("PhoneYa2 communication centre data request failed:", statuses.join(","));
      return json({ error: "Communication data is not ready. Confirm that supabase/communication-centre.sql has been run in Supabase SQL Editor." }, 503);
    }
    const [stats, activity, subscribers, automations] = await Promise.all([
      statsResponse.json(), activityResponse.json(), subscriberResponse.json(), automationResponse.json()
    ]);
    let phoneActivity=[],d1Activity=[],d1Stats={};
    if(env.DB){
      try{
        const [phoneRows,emailRows,counts]=await Promise.all([
          env.DB.prepare("SELECT id,campaign_id,recipient,recipient_name,channel,event_type,status,provider,provider_message_id,error_message,created_at FROM communication_activity ORDER BY created_at DESC LIMIT 250").all(),
          env.DB.prepare("SELECT id,created_at,sent_at,event_type,source,trigger_source,recipient_email,recipient_name,subject,status,provider,provider_message_id,error_message,related_order_number,related_product_slug,campaign_id,retry_count,metadata_json FROM email_activity ORDER BY created_at DESC LIMIT 250").all(),
          env.DB.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN source='automatic' THEN 1 ELSE 0 END) AS automatic,SUM(CASE WHEN source='manual' THEN 1 ELSE 0 END) AS manual,SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) AS sent,SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,SUM(CASE WHEN created_at>=datetime('now','-30 days') THEN 1 ELSE 0 END) AS last_30_days,SUM(CASE WHEN status='failed' AND created_at>=datetime('now','-30 days') THEN 1 ELSE 0 END) AS failed_last_30_days FROM email_activity").first()
        ]);
        phoneActivity=phoneRows.results||[];
        d1Activity=(emailRows.results||[]).map(row=>{let metadata={};try{metadata=JSON.parse(row.metadata_json||"{}")}catch{}return {...row,metadata};});
        d1Stats=counts||{};
      }catch(error){console.warn("PhoneYa2 D1 communication activity is not fully ready:",String(error).slice(0,180));}
    }
    const combinedActivity=[...(Array.isArray(activity)?activity:[]),...d1Activity].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,250);
    const combinedStats={};
    for(const key of ["total","automatic","manual","sent","delivered","bounced","failed","queued","last_30_days","failed_last_30_days"])combinedStats[key]=Number(stats?.[key]||0)+Number(d1Stats?.[key]||0);
    return json({
      success: true,
      phone_activity: phoneActivity,
      stats: combinedStats,
      activity: combinedActivity,
      subscriber_summary: {
        total: Array.isArray(subscribers) ? subscribers.length : 0,
        subscribed: Array.isArray(subscribers) ? subscribers.filter(s => s.status === "subscribed").length : 0,
        pending: Array.isArray(subscribers) ? subscribers.filter(s => s.status === "pending").length : 0,
        unsubscribed: Array.isArray(subscribers) ? subscribers.filter(s => s.status === "unsubscribed").length : 0,
        bounced: Array.isArray(subscribers) ? subscribers.filter(s => s.status === "bounced").length : 0
      },
      automations: Array.isArray(automations) ? automations : [],
      activity_limit: 250
    });
  } catch (error) {
    console.error("PhoneYa2 communication centre failed:", String(error));
    return json({ error: "Could not load communication activity. Please try again." }, 503);
  }
}
