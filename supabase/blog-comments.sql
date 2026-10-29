-- PhoneYa2 blog comments — dedicated Supabase table
-- Run once in Supabase Dashboard → SQL Editor.
-- Reuses the existing Supabase project and built-in anon role; creates no new role.
-- Public visitors can read approved comments and submit pending comments only.
-- Moderation can be performed in the Supabase Table Editor.

create table if not exists public.blog_comments (
  id uuid primary key default gen_random_uuid(),
  post_slug text not null
    check (post_slug ~ '^[a-z0-9][a-z0-9-]{0,179}$'),
  commenter text not null
    check (char_length(btrim(commenter)) between 2 and 60),
  message text not null
    check (char_length(btrim(message)) between 3 and 1200),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now()
);

create index if not exists blog_comments_public_lookup_idx
  on public.blog_comments (post_slug, status, submitted_at desc);

alter table public.blog_comments enable row level security;

drop policy if exists "Public can read approved blog comments"
  on public.blog_comments;
create policy "Public can read approved blog comments"
  on public.blog_comments
  for select
  to anon
  using (status = 'approved');

drop policy if exists "Public can submit pending blog comments"
  on public.blog_comments;
create policy "Public can submit pending blog comments"
  on public.blog_comments
  for insert
  to anon
  with check (status = 'pending');

-- Limit anonymous inserts to these fields. The database sets id, status,
-- and submitted_at, so a visitor cannot mark their own comment approved.
grant select on public.blog_comments to anon;
grant insert (post_slug, commenter, message) on public.blog_comments to anon;
