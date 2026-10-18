// Cloudflare Pages Function: validates the shared PY2-360 code and returns aggregate-only sales and lead metrics.
// No customer names, phone numbers, emails, addresses, notes, or individual lead details are returned.
const SUPABASE_URL = "https://kavwhkznlhtcwabatmru.supabase.co";

export async function onRequestPost({ request, env }) {
  const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
  // The agent tables already permit the public anon role. Use the existing publishable key as a fallback so the dashboard does not depend on an unconfigured service-role secret. Return aggregate fields only.
  const publicKey = env.SUPABASE_ANON_KEY || "sb_publishable_pJzzNclsEPNq1bev2zVN5g_z7eOa5ei";
  let body;
  try { body = await request.json(); } catch { return reply(400, { error: "Enter the PY2-360 access code." }); }
  if (String(body?.code || "").trim().toUpperCase() !== "PY2-360") return reply(401, { error: "Incorrect PY2-360 access code." });
  const key = env.SUPABASE_SERVICE_ROLE_KEY || publicKey;
  const query = async (table, params) => {
    const url = new URL(SUPABASE_URL + "/rest/v1/" + table);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url, { headers: { apikey: key, Authorization: "Bearer " + key, Accept: "application/json" } });
    if (!res.ok) { const detail = await res.text().catch(() => ""); throw new Error(table + " query failed (" + res.status + "): " + detail.slice(0, 180)); }
    return res.json();
  };
  try {
    const [sales, leads] = await Promise.all([
      query("sales", { select: "created_at,confirmed_at,amount,status", order: "created_at.desc", limit: "5000" }),
      query("leads", { select: "status,created_at", order: "created_at.desc", limit: "5000" })
    ]);
    return reply(200, { agent: { agent_code: "PY2-360", agent_id: "PY2-360", full_name: "PhoneYa2 Shared Desk" }, scope: "storewide_aggregate_only", sales: sales.map(s => ({ created_at: s.created_at, confirmed_at: s.confirmed_at, amount: Number(s.amount || 0), status: s.status || "pending" })), leads: leads.map(l => ({ status: l.status || "new", created_at: l.created_at })) });
  } catch (error) {
    console.error("PY2-360 aggregate dashboard query failed:", error?.message || error);
    return reply(503, { error: "Could not load real sales/lead data. Check that the agent Supabase tables exist and that their anon read policies are enabled. The underlying query error is recorded in Cloudflare logs." });
  }
}

export async function onRequest({ request }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "allow": "POST, OPTIONS" } });
  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "content-type": "application/json", "allow": "POST, OPTIONS", "cache-control": "no-store" } });
}