-- ════════════════════════════════════════════════════════════════════════════
-- 20260602000018_review_author_name
-- Denormalize a public reviewer display name onto reviews so it can be shown on
-- public pages and emitted as schema.org Review/author (profiles RLS hides other
-- users' names from anon). Captured at write time from the author's profile.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

alter table public.reviews add column author_name text;
alter table public.product_reviews add column author_name text;

-- Backfill any existing rows from the author's profile display name.
update public.reviews r
  set author_name = coalesce(p.display_name, 'Weedtip member')
  from public.profiles p
  where p.id = r.user_id and r.author_name is null;

update public.product_reviews r
  set author_name = coalesce(p.display_name, 'Weedtip member')
  from public.profiles p
  where p.id = r.user_id and r.author_name is null;
