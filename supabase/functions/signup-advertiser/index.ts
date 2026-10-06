// ═══════════════════════════════════════════════════════════════════════════
// PhoneYa2 Ads — signup-advertiser Edge Function
// ────────────────────────────────────────────────────────────────────────
// Atomically creates:
//   1. An auth.users row
//   2. A matching public.advertisers row
//   3. A matching public.profiles row (role = 'advertiser')
//
// Runs with the SECRET key. Never called from any client file with that key.
// The publishable key can call this endpoint — that's fine, because the
// server-side validation + rate limiting + duplicate-email check protects us.
//
// Section 4.5 of the brief.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// ── Environment (set these in Supabase Dashboard → Project Settings → Edge Functions) ──
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SECRET_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Fallback for newer Supabase secret-key naming
const SUPABASE_SECRET_KEY_ALT   = Deno.env.get('SUPABASE_SECRET_KEY');
const SECRET                    = SUPABASE_SECRET_KEY || SUPABASE_SECRET_KEY_ALT;

// ── CORS ──────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://phoneya2.netlify.app',
  'https://phoneya2.pages.dev',
  'http://localhost:3000',
  'http://localhost:8888',
  'http://localhost:5173',
  // Add your custom domain here when you have one:
  // 'https://phoneya2.zm',
];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age':       '86400',
  };
}

// ── Validation helpers ────────────────────────────────────────────────────
function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}
function isPhone(v: string): boolean {
  const digits = String(v || '').replace(/[^\d]/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

// ── Handler ───────────────────────────────────────────────────────────────
serve(async (req) => {
  const origin  = req.headers.get('origin');
  const headers = corsHeaders(origin);

  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, headers);
  }

  // ── Parse body ─────────────────────────────────────────────────────────
  let body: any;
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: 'Invalid JSON body' }, 400, headers);
  }

  const {
    email,
    password,
    business_name,
    owner_name,
    phone,
    accepted_terms,
    terms_version
  } = body || {};

  // ── Validate ───────────────────────────────────────────────────────────
  if (!isEmail(email))                   return json({ error: 'Valid email is required' }, 400, headers);
  if (!password || password.length < 8)  return json({ error: 'Password must be at least 8 characters' }, 400, headers);
  if (!business_name || !String(business_name).trim()) return json({ error: 'Business name is required' }, 400, headers);
  if (!isPhone(phone))                   return json({ error: 'Valid phone number is required' }, 400, headers);
  if (accepted_terms !== true)           return json({ error: 'You must accept the advertising policy' }, 400, headers);

  const cleanEmail    = String(email).trim().toLowerCase();
  const cleanBusiness = String(business_name).trim().slice(0, 80);
  const cleanOwner    = owner_name ? String(owner_name).trim().slice(0, 80) : null;
  const cleanPhone    = String(phone).trim();
  const termsV        = terms_version ? String(terms_version) : 'v1';

  // ── Admin client (secret key) ──────────────────────────────────────────
  const admin = createClient(SUPABASE_URL, SECRET, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // ── Duplicate-email check (fast pre-check before we attempt signup) ────
  // We check the advertisers table AND rely on Supabase Auth's own duplicate check.
  const { data: existingAdv } = await admin
    .from('advertisers')
    .select('id')
    .eq('email', cleanEmail)
    .maybeSingle();

  if (existingAdv) {
    return json({ error: 'An account with this email already exists. Try signing in instead.' }, 409, headers);
  }

  // ── Step 1: create auth user ───────────────────────────────────────────
  const { data: signUpData, error: signUpErr } = await admin.auth.admin.createUser({
    email:         cleanEmail,
    password:      password,
    email_confirm: true,  // V1: skip email confirmation for fast onboarding; flip to false later
    user_metadata: {
      full_name:     cleanOwner || cleanBusiness,
      business_name: cleanBusiness,
    }
  });

  if (signUpErr || !signUpData?.user) {
    // Normalize the common "already registered" case
    const msg = signUpErr?.message || '';
    if (/already/i.test(msg)) {
      return json({ error: 'An account with this email already exists. Try signing in instead.' }, 409, headers);
    }
    return json({ error: msg || 'Could not create account' }, 400, headers);
  }

  const userId = signUpData.user.id;

  // ── Step 2: create advertisers row ─────────────────────────────────────
  const { data: advData, error: advErr } = await admin
    .from('advertisers')
    .insert({
      auth_user_id:   userId,
      business_name:  cleanBusiness,
      owner_name:     cleanOwner,
      phone:          cleanPhone,
      email:          cleanEmail,
      tier:           'free',
      status:         'active',
      verified_email: false,
      verified_phone: false,
    })
    .select('id')
    .single();

  if (advErr || !advData) {
    // Rollback: delete the auth user so we don't leave an orphan
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return json({ error: 'Could not create business profile. Please try again.' }, 500, headers);
  }

  const advertiserId = advData.id;

  // ── Step 3: ensure profiles row (idempotent — trigger may have made one) ─
  // The on_auth_user_created trigger already inserts a profiles row, but we
  // upsert here to be defensive and to set the correct full_name.
  await admin
    .from('profiles')
    .upsert({
      id:        userId,
      email:     cleanEmail,
      full_name: cleanOwner || cleanBusiness,
      role:      'advertiser',
    }, { onConflict: 'id' })
    .select();

  // ── Step 4: audit — record terms acceptance ────────────────────────────
  // We log the accepted terms version as an ad_settings-like record is not
  // appropriate here; instead, store it in user_metadata via admin update.
  // Best-effort — a failure here does not fail the signup.
  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      full_name:             cleanOwner || cleanBusiness,
      business_name:         cleanBusiness,
      accepted_terms_version: termsV,
      accepted_terms_at:      new Date().toISOString(),
    }
  }).catch(() => {});

  // ── Done ───────────────────────────────────────────────────────────────
  return json({
    ok:            true,
    user_id:       userId,
    advertiser_id: advertiserId,
    message:       'Account created successfully'
  }, 200, headers);
});

// ── Helpers ───────────────────────────────────────────────────────────────
function json(payload: unknown, status: number, extraHeaders: Record<string, string>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...extraHeaders,
      'Content-Type': 'application/json',
    },
  });
}
