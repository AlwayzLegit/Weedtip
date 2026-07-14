-- ════════════════════════════════════════════════════════════════════════════
-- 20260714100000_dispensary_dedup
--
-- SEMrush audit root cause: two import passes created two slugs for the same
-- physical shop (`a-cut-above` + `a-cut-above-denver`, `livwell` … `livwell-25`),
-- producing ~1,868 duplicate-title / duplicate-content / duplicate-meta errors.
--
-- Dedup is LOCATION-AWARE, not name-based: the key is (lower(name), state,
-- lat/lng rounded to ~110 m). A naive name+city key would have deleted 609 rows
-- and destroyed 222 real chain branches (multiple LivWell/Native Roots
-- locations in one city are DISTINCT shops at distinct addresses — they are
-- kept). Only same-name-same-location rows collapse: 256 groups, 302 losers.
-- All losers are unclaimed (owner_id is null); 0 claimed rows are touched.
--
-- Winner per group: most enrichment (google_place_id/cover/phone/website/
-- hours/logo), then most reviews, then shortest (cleanest) slug, then oldest.
-- Loser slugs 301-redirect to the winner via dispensary_redirects so any
-- indexed/linked old URL passes equity instead of 404ing. FKs from the losers
-- (their synthetic products/deals/etc) cascade-delete; orders is RESTRICT but
-- prod has none on these rows.
--
-- Also removes the demo "Green Leaf NYC" listing (fabricated menu/deals/review
-- from local seed data) that was live in the prod directory.
-- ════════════════════════════════════════════════════════════════════════════

-- Slug → surviving-slug redirect map (public read; the 301 handler uses anon).
create table if not exists public.dispensary_redirects (
  old_slug   text primary key,
  new_slug   text not null,
  created_at timestamptz not null default now()
);
alter table public.dispensary_redirects enable row level security;
drop policy if exists "dispensary_redirects_public_read" on public.dispensary_redirects;
create policy "dispensary_redirects_public_read"
  on public.dispensary_redirects for select using (true);

-- Rank rows within each (name, state, ~110 m) group; rn=1 is the survivor.
create temp table _dedup on commit drop as
with base as (
  select id, slug,
    lower(btrim(name)) as k_name, state,
    round(latitude::numeric, 3) as rlat, round(longitude::numeric, 3) as rlng,
    (google_place_id is not null)::int + (cover_image_url is not null)::int
      + (phone is not null)::int + (website is not null)::int
      + (hours is not null)::int + (logo_url is not null)::int as enrich,
    coalesce(rating_count, 0) as rc, created_at
  from public.dispensaries
  where status = 'active' and owner_id is null and latitude is not null
),
ranked as (
  select *,
    count(*) over (partition by k_name, state, rlat, rlng) as grp_n,
    row_number() over (partition by k_name, state, rlat, rlng
      order by enrich desc, rc desc, length(slug) asc, created_at asc) as rn,
    first_value(slug) over (partition by k_name, state, rlat, rlng
      order by enrich desc, rc desc, length(slug) asc, created_at asc) as win_slug
  from base
)
select id, slug, win_slug, rn from ranked where grp_n > 1;

-- Redirect every loser slug to its group's survivor.
insert into public.dispensary_redirects (old_slug, new_slug)
select slug, win_slug from _dedup where rn > 1
on conflict (old_slug) do update set new_slug = excluded.new_slug;

-- Remove the duplicate rows (children cascade).
delete from public.dispensaries d
using _dedup x
where d.id = x.id and x.rn > 1;

-- Remove the fabricated demo listing.
delete from public.dispensaries
where id = 'a1000000-0000-4000-8000-000000000001';
