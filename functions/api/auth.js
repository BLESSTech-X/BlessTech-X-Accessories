import { createAdminSession, getAdminSession, adminCookie, clearAdminCookie, sameOrigin } from "../_auth.js";

const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...HEADERS, ...extra } });
}
async function passwordMatches(input, expected) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(String(input || ""))),
    crypto.subtle.digest("SHA-256", encoder.encode(String(expected || "")))
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
async function rateLimit(request, env, success = false) {
  if (!env.DB) throw new Error("D1 database binding DB is missing.");
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS admin_login_attempts (ip_hash TEXT NOT NULL, attempted_at INTEGER NOT NULL)").run();
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  const ipHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare("DELETE FROM admin_login_attempts WHERE attempted_at < ?").bind(now - 3600).run();
  const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM admin_login_attempts WHERE ip_hash = ? AND attempted_at > ?").bind(ipHash, now - 900).first("total");
  if (!success && Number(count || 0) >= 5) return false;
  if (success) {
    await env.DB.prepare("DELETE FROM admin_login_attempts WHERE ip_hash = ?").bind(ipHash).run();
  } else {
    await env.DB.prepare("INSERT INTO admin_login_attempts (ip_hash, attempted_at) VALUES (?, ?)").bind(ipHash, now).run();
  }
  return true;
}
export async function onRequest({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin request blocked." }, 403);
  if (request.method === "GET") {
    const user = await getAdminSession(request, env);
    return user ? json({ authenticated: true, email: user.email }) : json({ authenticated: false }, 401);
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  if (body.action === "logout") return json({ authenticated: false }, 200, { "set-cookie": clearAdminCookie() });
  const email = String(body.email || "").trim().toLowerCase();
  const supplied = String(body.password || "");
  const expected = String(env.PHONEYA2_ADMIN_PASSWORD || "");
  if (expected.length < 20) return json({ error: "Admin authentication is not configured correctly. Check the Cloudflare secret." }, 503);
  if (!(await rateLimit(request, env))) return json({ error: "Too many failed attempts. Try again in 15 minutes." }, 429);
  if (email !== "singbless89@gmail.com" || supplied.length < 1 || !(await passwordMatches(supplied, expected))) {
    await rateLimit(request, env);
    return json({ error: "The administrator email or password is incorrect." }, 401);
  }
  await rateLimit(request, env, true);
  const token = await createAdminSession(env);
  return json({ authenticated: true, email: "singbless89@gmail.com" }, 200, { "set-cookie": adminCookie(token) });
}
