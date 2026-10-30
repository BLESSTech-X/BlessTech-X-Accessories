-- PhoneYa2 Seasonal Campaign Studio: complete banner and image settings
-- Run this migration in the SAME Supabase project used by the Command Centre login.

alter table public.seasonal_campaigns
  add column if not exists banner boolean not null default true,
  add column if not exists "bannerTitle" text not null default 'The PhoneYa2 Christmas Edit',
  add column if not exists "bannerMessage" text not null default 'Thoughtful tech gifts. Better-connected moments.',
  add column if not exists "bannerButton" text not null default 'Explore Christmas Picks',
  add column if not exists "bannerUrl" text not null default '/shop.html',
  add column if not exists "bannerImage" text not null default '',
  add column if not exists "popupImage" text not null default '';

update public.seasonal_campaigns
set updated_at = now()
where id = 'global';
