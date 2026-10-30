-- PhoneYa2 Seasonal Experience: shared campaign configuration
-- Safe to run once in the Supabase SQL Editor. Re-running is also safe.

create table if not exists public.seasonal_campaigns (
  id text primary key check (id = 'global'),
  enabled boolean not null default false,
  theme text not null default 'christmas',
  decorations boolean not null default true,
  snow boolean not null default false,
  "snowIntensity" integer not null default 24 check ("snowIntensity" between 0 and 70),
  popup boolean not null default false,
  "popupTitle" text not null default 'Make Their Christmas Special',
  "popupMessage" text not null default 'Discover thoughtful gifts, explore festive offers and shop your favourite phone accessories.',
  "popupButton" text not null default 'Shop Christmas Deals',
  "popupUrl" text not null default '/shop.html',
  "popupMode" text not null default 'delay',
  "popupDelay" integer not null default 5 check ("popupDelay" between 0 and 60),
  "popupScroll" integer not null default 35 check ("popupScroll" between 5 and 90),
  scheduled boolean not null default false,
  start date not null default date '2026-11-15',
  "end" date not null default date '2026-12-27',
  coverage text not null default 'all',
  updated_at timestamptz not null default now()
);

-- Bring forward installations created from an earlier, partial version.
alter table public.seasonal_campaigns
  add column if not exists decorations boolean not null default true,
  add column if not exists snow boolean not null default false,
  add column if not exists "snowIntensity" integer not null default 24,
  add column if not exists popup boolean not null default false,
  add column if not exists "popupTitle" text not null default 'Make Their Christmas Special',
  add column if not exists "popupMessage" text not null default 'Discover thoughtful gifts, explore festive offers and shop your favourite phone accessories.',
  add column if not exists "popupButton" text not null default 'Shop Christmas Deals',
  add column if not exists "popupUrl" text not null default '/shop.html',
  add column if not exists "popupMode" text not null default 'delay',
  add column if not exists "popupDelay" integer not null default 5,
  add column if not exists "popupScroll" integer not null default 35,
  add column if not exists scheduled boolean not null default false,
  add column if not exists start date not null default date '2026-11-15',
  add column if not exists "end" date not null default date '2026-12-27',
  add column if not exists coverage text not null default 'all',
  add column if not exists updated_at timestamptz not null default now();

alter table public.seasonal_campaigns enable row level security;

drop policy if exists "Seasonal settings are publicly readable" on public.seasonal_campaigns;
create policy "Seasonal settings are publicly readable"
  on public.seasonal_campaigns
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Only PhoneYa2 administrator can manage seasonal settings" on public.seasonal_campaigns;
create policy "Only PhoneYa2 administrator can manage seasonal settings"
  on public.seasonal_campaigns
  for all
  to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'singbless89@gmail.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'singbless89@gmail.com');

grant select on public.seasonal_campaigns to anon, authenticated;
grant insert, update, delete on public.seasonal_campaigns to authenticated;

insert into public.seasonal_campaigns (id)
values ('global')
on conflict (id) do nothing;
