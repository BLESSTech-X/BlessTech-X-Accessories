// Cloudflare Pages Function: validates an active agent code and returns only that agent's dashboard-safe aggregates.
const SUPABASE_URL = "https://kavwhkznlhtcwabatmru.supabase.co";

export async function onRequestPost({ request, env }) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  };
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return reply(503, { error: "Agent sign-in is not configured yet. Please contact the PhoneYa2 administrator." });
  }

  let body;
  try { body = await request.json(); }
  catch { return reply(400, { error: "Enter your agent code." }); }

  const code = String(body?.code || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
    return reply(400, { error: "Enter a valid agent code." });
  }

  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const query = async (table, params) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" }
    });
    if (!res.ok) throw new Error(`Supabase query failed (${res.status})`);
    return res.json();
  };

  try {
    const agents = await query("agents", {
      agent_code: `eq.${code}`,
      active: "eq.true",
      select: "agent_code,full_name,agent_id,active",
      limit: "1"
    });
    const agent = agents?.[0];
    if (!agent) return reply(401, { error: "That code is not recognised or the agent account is inactive." });

    const [sales, leads] = await Promise.all([
      query("sales", {
        agent_code: `eq.${code}`,
        select: "agent_code,created_at,confirmed_at,amount,status",
        order: "created_at.desc",
        limit: "500"
      }),
      query("leads", {
        agent_code: `eq.${code}`,
        select: "agent_code,status,created_at,followup_date",
        order: "created_at.desc",
        limit: "500"
      })
    ]);

    return reply(200, { agent, sales, leads });
  } catch (error) {
    console.error("PY2-360 agent dashboard query failed:", error?.message || error);
    return reply(503, { error: "Could not verify the code right now. Please try again shortly." });
  }
}

export async function onRequest({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "allow": "POST, OPTIONS" } });
  }
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "content-type": "application/json", "allow": "POST, OPTIONS", "cache-control": "no-store" }
  });
}
