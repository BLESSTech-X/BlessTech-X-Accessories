const COOKIE = "__Host-py2_admin";
const ADMIN_EMAIL = "singbless89@gmail.com";
const SESSION_SECONDS = 8 * 60 * 60;

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
function readCookie(request) {
  const prefix = COOKIE + "=";
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const item = part.trim();
    if (item.startsWith(prefix)) return item.slice(prefix.length);
  }
  return "";
}
async function hmac(payload, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
}
export async function createAdminSession(env) {
  const secret = String(env.PHONEYA2_ADMIN_PASSWORD || "");
  if (secret.length < 8) throw new Error("PhoneYa2 admin password secret is missing or too short.");
  const payload = base64url(new TextEncoder().encode(JSON.stringify({
    email: ADMIN_EMAIL,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  })));
  return payload + "." + await hmac(payload, secret);
}
export async function getAdminSession(request, env) {
  const secret = String(env.PHONEYA2_ADMIN_PASSWORD || "");
  if (secret.length < 8) return null;
  const token = readCookie(request);
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const expected = await hmac(parts[0], secret);
  let valid = false;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    valid = await crypto.subtle.verify("HMAC", key, fromBase64url(parts[1]), new TextEncoder().encode(parts[0]));
  } catch { return null; }
  if (!valid) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(parts[0])));
    if (payload.email !== ADMIN_EMAIL || !Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return { email: ADMIN_EMAIL };
  } catch { return null; }
}
export function adminCookie(token) {
  return COOKIE + "=" + token + "; Path=/; Max-Age=" + SESSION_SECONDS + "; HttpOnly; Secure; SameSite=Strict";
}
export function clearAdminCookie() {
  return COOKIE + "=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict";
}
export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.method === "GET" || request.headers.get("sec-fetch-site") === "same-origin";
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}
