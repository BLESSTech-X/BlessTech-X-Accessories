-- PhoneYa2 shared seasonal campaign settings
create table if not exists public.seasonal_campaigns (
  id text primary key check (id = 'global'),
  enabled boolean not null default false,
  theme text not null default 'christmas',
  decorations boolean not null default true,
  snow boolean not null default false,
  "snowIntensity" integer not null default 30 check ("snowIntensity" between 10 and 70),
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
alter table public.seasonal_campaigns enable row level security;
drop policy if exists "Seasonal settings are publicly readable" on public.seasonal_campaigns;
create policy "Seasonal settings are publicly readable" on public.seasonal_campaigns
  for select to anon, authenticated using (true);
drop policy if exists "Only PhoneYa2 administrator can manage seasonal settings" on public.seasonal_campaigns;
create policy "Only PhoneYa2 administrator can manage seasonal settings" on public.seasonal_campaigns
  for all to authenticated
  using (lower(coalesce(auth.jwt()->>'email','')) = 'singbless89@gmail.com')
  with check (lower(coalesce(auth.jwt()->>'email','')) = 'singbless89@gmail.com');
grant select on public.seasonal_campaigns to anon, authenticated;
grant insert, update, delete on public.seasonal_campaigns to authenticated;
insert into public.seasonal_campaigns (id) values ('global') on conflict (id) do nothing;
