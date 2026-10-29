-- PhoneYa2 shared storefront seasonal/event theme settings.
-- Run once in the PhoneYa2 Supabase SQL Editor.
create table if not exists public.phoneya2_site_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.phoneya2_site_settings enable row level security;
revoke all on public.phoneya2_site_settings from anon, authenticated;
insert into public.phoneya2_site_settings (setting_key, setting_value)
values ('seasonal_theme', '{"theme":"none","title":"","message":"","effects":false,"popup":false,"banner":false,"end_date":null}'::jsonb)
on conflict (setting_key) do nothing;
