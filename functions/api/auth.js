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
  if (email !== "singbless89@gmail.com" || supplied.length < 1 || !(await passwordMatches(supplied, expected))) {
    return json({ error: "The administrator email or password is incorrect." }, 401);
  }
  const token = await createAdminSession(env);
  return json({ authenticated: true, email: "singbless89@gmail.com" }, 200, { "set-cookie": adminCookie(token) });
}
