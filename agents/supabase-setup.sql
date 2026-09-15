-- ═══════════════════════════════════════════════════════════════════════
-- PhoneYa2 Agent Network — Supabase Database Setup
-- Run this in the Supabase SQL editor (one-time setup)
-- ═══════════════════════════════════════════════════════════════════════

-- 1. APPLICATIONS TABLE
create table if not exists applications (
  id            uuid primary key default gen_random_uuid(),
  app_id        text unique not null,           -- PY-2026-0001
  full_name     text not null,
  phone         text not null,
  whatsapp      text not null,
  email         text,
  location      text not null,
  occupation    text,
  platforms     text,                           -- comma-separated social platforms
  experience    text,
  reach         text,                           -- estimated network size
  motivation    text,
  agree_commission boolean default false,
  agree_terms      boolean default false,
  agree_accurate   boolean default false,
  status        text default 'pending',         -- pending / approved / rejected
  admin_notes   text,
  created_at    timestamptz default now()
);

-- 2. AGENTS TABLE
create table if not exists agents (
  id            uuid primary key default gen_random_uuid(),
  app_id        text references applications(app_id),
  agent_id      text unique not null,           -- PYA-0001
  agent_code    text unique not null,           -- PY001 (login token)
  full_name     text not null,
  phone         text not null,
  whatsapp      text not null,
  location      text,
  referral_url  text,                           -- full referral link
  active        boolean default true,
  joined_at     timestamptz default now()
);

-- 3. LEADS TABLE
create table if not exists leads (
  id            uuid primary key default gen_random_uuid(),
  lead_id       text unique not null,           -- L-0001
  agent_code    text not null,
  customer_name text not null,
  customer_wa   text not null,
  product       text not null,
  notes         text,
  expected_date text,
  status        text default 'interested',      -- interested / purchased / lost / followup
  created_at    timestamptz default now()
);

-- 4. SALES TABLE
create table if not exists sales (
  id            uuid primary key default gen_random_uuid(),
  sale_id       text unique not null,           -- S-0001
  agent_code    text not null,
  product       text not null,
  amount        integer not null,               -- ZMW
  commission    integer not null,               -- ZMW
  status        text default 'pending',         -- pending / confirmed / paid
  confirmed_at  timestamptz,
  created_at    timestamptz default now()
);

-- 5. COUNTERS TABLE (for sequential IDs)
create table if not exists counters (
  name  text primary key,
  value integer default 0
);
insert into counters (name, value) values
  ('applications', 0),
  ('leads', 0),
  ('sales', 0)
on conflict (name) do nothing;

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- Allow anon read/write on all tables (admin auth handled in JS)
-- For production you'd add proper RLS policies

alter table applications enable row level security;
alter table agents       enable row level security;
alter table leads        enable row level security;
alter table sales        enable row level security;
alter table counters     enable row level security;

-- Allow full anon access (the anon key is used for all operations)
-- You should tighten this in production
create policy "anon_all_applications" on applications for all to anon using (true) with check (true);
create policy "anon_all_agents"       on agents       for all to anon using (true) with check (true);
create policy "anon_all_leads"        on leads        for all to anon using (true) with check (true);
create policy "anon_all_sales"        on sales        for all to anon using (true) with check (true);
create policy "anon_all_counters"     on counters     for all to anon using (true) with check (true);

-- ── COMMISSION RATES (reference — not a table, set in JS config) ─────────────
-- Phone Cases:       ZMW 15 per sale
-- Chargers:          ZMW 20 per sale
-- Earphones:         ZMW 25 per sale
-- Power Banks:       ZMW 30 per sale
-- Cables:            ZMW 10 per sale
-- Smart Watch:       ZMW 40 per sale
-- Phones (refurb):   ZMW 150 per sale

-- ═══════════════════════════════════════════════════════════════════════
-- After running this SQL:
-- 1. Go to Settings > API in Supabase
-- 2. Copy your Project URL and anon key
-- 3. Paste them into config.js below
-- ═══════════════════════════════════════════════════════════════════════
