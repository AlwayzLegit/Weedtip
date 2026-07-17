-- ════════════════════════════════════════════════════════════════════════════
-- 20260718100000_brand_reviews
--
-- Brand-level ratings (Weedmaps parity: brand tiles carry star ratings).
-- Mirrors the dispensary reviews pattern: a brand_reviews table (one review
-- per user per brand) plus trigger-maintained rating_avg / rating_count
-- denormalized onto brands so tiles and rails read them without aggregate
-- subqueries.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.brands
  add column if not exists rating_avg numeric(2, 1) not null default 0,
  add column if not exists rating_count integer not null default 0;

create table public.brand_reviews (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text check (char_length(body) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, user_id)
);

create index idx_brand_reviews_brand_id on public.brand_reviews (brand_id, created_at desc);
create index idx_brand_reviews_user_id on public.brand_reviews (user_id);

alter table public.brand_reviews enable row level security;

create policy brand_reviews_select_public on public.brand_reviews
  for select to anon, authenticated using (true);
create policy brand_reviews_insert_self on public.brand_reviews
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy brand_reviews_update_self on public.brand_reviews
  for update to authenticated using (user_id = (select auth.uid()));
create policy brand_reviews_delete_self on public.brand_reviews
  for delete to authenticated using (user_id = (select auth.uid()));

-- Aggregate sync. SECURITY DEFINER so a consumer writing their own review can
-- drive the brands update that RLS would otherwise forbid.
create or replace function public.recalc_brand_rating(target_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.brands b
  set rating_avg = coalesce(
        (select round(avg(rating)::numeric, 1) from public.brand_reviews where brand_id = target_id),
        0
      ),
      rating_count = (select count(*) from public.brand_reviews where brand_id = target_id)
  where b.id = target_id;
$$;

create or replace function public.brand_reviews_rating_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recalc_brand_rating(coalesce(new.brand_id, old.brand_id));
  return null;
end;
$$;

create trigger brand_reviews_sync_rating
  after insert or update or delete on public.brand_reviews
  for each row
  execute function public.brand_reviews_rating_sync();

-- Reviewer display name captured at write time: profiles are self-or-admin
-- readable, so public review lists can't join them.
alter table public.brand_reviews add column author_name text;
