-- ════════════════════════════════════════════════════════════════════════════
-- 20260719220000_ads_v2
-- Ads engine v2 (user-approved strategy):
--   1. DYNAMIC STEP PRICING — each claimed spot raises the next spot's price
--      ~15%, from launch_price up to (capped at) list_price. Scarcity you can
--      see: the rate card always shows the CURRENT price for the next spot.
--   2. HOUSE PLACEMENTS (cold start) — admin-comped fills flagged is_house,
--      labeled "Featured" on the site (not "Sponsored" — nobody paid), always
--      preempted by a real paid claim, and time-boxed so they decay.
--   3. AD REQUESTS — sold-out inventory and renewal acceptances land in an
--      in-admin action queue (ad_requests), not an inbox.
--   4. RENEWAL FIRST RIGHT — expiring paid subs carry a renewal offer at the
--      then-current step price; the incumbent gets it before the open market.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

alter table public.ad_subscriptions
  add column if not exists is_house boolean not null default false,
  add column if not exists renewal_price_cents integer,
  add column if not exists renewal_offered_at timestamptz;

create table if not exists public.ad_requests (
  id            uuid primary key default extensions.gen_random_uuid(),
  dispensary_id uuid not null references public.dispensaries (id) on delete cascade,
  region_id     uuid not null references public.ad_regions (id) on delete cascade,
  slot_type     public.ad_slot_type not null,
  kind          text not null default 'availability'
    check (kind in ('availability', 'renewal_accept')),
  status        text not null default 'open'
    check (status in ('open', 'resolved', 'dismissed')),
  created_at    timestamptz not null default now(),
  unique (dispensary_id, region_id, slot_type, kind)
);

alter table public.ad_requests enable row level security;

drop policy if exists ad_requests_own on public.ad_requests;
create policy ad_requests_own on public.ad_requests
  for select to authenticated
  using (public.owns_dispensary(dispensary_id) or public.is_admin());

drop policy if exists ad_requests_insert on public.ad_requests;
create policy ad_requests_insert on public.ad_requests
  for insert to authenticated
  with check (public.owns_dispensary(dispensary_id) or public.is_admin());

drop policy if exists ad_requests_admin_update on public.ad_requests;
create policy ad_requests_admin_update on public.ad_requests
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Current price for the NEXT spot of a type in a region: launch price stepped
-- up 15% per PAID live claim (house fills don't raise prices), capped at list.
create or replace function public.slot_price_cents(
  p_region_id uuid,
  p_slot_type public.ad_slot_type
)
returns integer
language sql
stable
set search_path = public
as $$
  with product as (
    select p.launch_price, p.list_price
    from public.ad_products p
    join public.ad_regions r on r.tier = p.tier
    where r.id = p_region_id and p.slot_type = p_slot_type
    limit 1
  ),
  claimed as (
    select count(*)::int as n
    from public.ad_subscriptions s
    join public.ad_slots sl on sl.id = s.slot_id
    where sl.region_id = p_region_id
      and sl.slot_type = p_slot_type
      and s.status in ('pending', 'active', 'past_due')
      and not s.is_house
  )
  select least(
    round(product.launch_price * power(1.15, claimed.n))::int,
    product.list_price
  )
  from product, claimed;
$$;
grant execute on function public.slot_price_cents(uuid, public.ad_slot_type) to anon, authenticated;

-- House-fill curation: the best-presenting active shops inside a region's
-- boundary that don't already hold a live sub there — the admin desk comps
-- these into open slots during the cold start. Admin-only.
create or replace function public.region_house_candidates(
  p_region_id uuid,
  p_limit integer default 10
)
returns table (
  dispensary_id uuid,
  name text,
  slug text,
  rating_avg numeric,
  rating_count integer,
  has_photo boolean
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select d.id, d.name, d.slug, d.rating_avg, d.rating_count,
         (d.cover_image_url is not null) as has_photo
  from public.dispensaries d
  join public.ad_regions r on r.id = p_region_id
  where d.status = 'active'
    and r.boundary is not null
    and st_intersects(r.boundary::geometry, d.location::geometry)
    and d.cover_image_url is not null
    and not exists (
      select 1
      from public.ad_subscriptions s
      join public.ad_slots sl on sl.id = s.slot_id
      where s.dispensary_id = d.id
        and sl.region_id = p_region_id
        and s.status in ('pending', 'active', 'past_due')
    )
  order by d.rating_avg desc, d.rating_count desc, d.featured desc, d.name
  limit greatest(p_limit, 1);
$$;

revoke all on function public.region_house_candidates(uuid, integer) from public, anon;
grant execute on function public.region_house_candidates(uuid, integer) to authenticated;

-- get_region_placements exposes is_house so serving can label honestly:
-- house fills render "Featured" (nobody paid), paid slots render "Sponsored".
drop function if exists public.get_region_placements(uuid);
create function public.get_region_placements(p_region_id uuid)
returns table (
  slot_type     public.ad_slot_type,
  "position"    integer,
  dispensary_id uuid,
  is_house      boolean
)
language sql
stable
set search_path = public
as $$
  select s.slot_type, s.position, sub.dispensary_id, sub.is_house
  from public.ad_slots s
  join public.ad_subscriptions sub on sub.slot_id = s.id and sub.status = 'active'
  where s.region_id = p_region_id
  order by
    case s.slot_type when 'exclusive' then 0 when 'featured' then 1 else 2 end,
    s.position;
$$;
grant execute on function public.get_region_placements(uuid) to anon, authenticated;
