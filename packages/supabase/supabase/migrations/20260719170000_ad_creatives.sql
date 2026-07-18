-- ════════════════════════════════════════════════════════════════════════════
-- 20260719170000_ad_creatives
--
-- Advertising creative library + scheduler (spec ⑥). Owners build reusable
-- creatives (image + headline + body) and attach one to a placement request;
-- the consumer surfaces (hero carousel, promoted rails) render the creative
-- instead of the raw shop cover when present. Placements also gain an
-- owner-requested start date so campaigns can be scheduled ahead — activation
-- (still admin reserve-then-confirm, no auto-charge) honors it.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create table if not exists public.ad_creatives (
  id            uuid primary key default extensions.gen_random_uuid(),
  dispensary_id uuid references public.dispensaries (id) on delete cascade,
  brand_id      uuid references public.brands (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  image_url     text not null,
  headline      text check (headline is null or char_length(headline) <= 80),
  body          text check (body is null or char_length(body) <= 140),
  created_at    timestamptz not null default now(),
  check (dispensary_id is not null or brand_id is not null)
);

create index if not exists ad_creatives_dispensary_idx on public.ad_creatives (dispensary_id);
create index if not exists ad_creatives_brand_idx on public.ad_creatives (brand_id);

alter table public.ad_creatives enable row level security;

-- Creatives render on public ad surfaces, so reads are open; writes belong to
-- the marketing capability (owner + campaign manager) or the brand owner.
drop policy if exists ad_creatives_select on public.ad_creatives;
create policy ad_creatives_select on public.ad_creatives
  for select to anon, authenticated using (true);

drop policy if exists ad_creatives_write_insert on public.ad_creatives;
create policy ad_creatives_write_insert on public.ad_creatives
  for insert to authenticated
  with check (
    (dispensary_id is not null and public.member_can(dispensary_id, 'marketing'))
    or (brand_id is not null and public.owns_brand(brand_id))
    or public.is_admin()
  );

drop policy if exists ad_creatives_write_update on public.ad_creatives;
create policy ad_creatives_write_update on public.ad_creatives
  for update to authenticated
  using (
    (dispensary_id is not null and public.member_can(dispensary_id, 'marketing'))
    or (brand_id is not null and public.owns_brand(brand_id))
    or public.is_admin()
  )
  with check (
    (dispensary_id is not null and public.member_can(dispensary_id, 'marketing'))
    or (brand_id is not null and public.owns_brand(brand_id))
    or public.is_admin()
  );

drop policy if exists ad_creatives_write_delete on public.ad_creatives;
create policy ad_creatives_write_delete on public.ad_creatives
  for delete to authenticated
  using (
    (dispensary_id is not null and public.member_can(dispensary_id, 'marketing'))
    or (brand_id is not null and public.owns_brand(brand_id))
    or public.is_admin()
  );

alter table public.placements
  add column if not exists creative_id uuid references public.ad_creatives (id) on delete set null,
  add column if not exists requested_start date;
