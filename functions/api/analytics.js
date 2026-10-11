export async function onRequest({ request, env }) {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.ADMIN_EMAIL) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const auth = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: "Bearer " + token }
  });
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const user = await auth.json();
  if (String(user.email || "").toLowerCase() !== String(env.ADMIN_EMAIL).toLowerCase()) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({ error: "Analytics reporting connector is being configured." }, { status: 503 });
}
