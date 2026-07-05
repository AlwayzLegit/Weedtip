-- 20260705090002_ad_functions
-- Geo resolution, placement serving, atomic slot claims, and stale-claim release.

-- ─── resolve_geo ─────────────────────────────────────────────────────────────
-- Resolve the ad zone + region for a point (user location). Prefers true
-- point-in-polygon when zone boundaries exist; falls back to the nearest zone
-- centroid within 15 km so the system works before polygons are drawn.
-- Returns zero rows outside any covered market.
create or replace function public.resolve_geo(lng float8, lat float8)
returns table (
  zone_id     uuid,
  zone_slug   text,
  zone_name   text,
  region_id   uuid,
  region_slug text,
  region_name text
)
language sql
stable
set search_path = public, extensions
as $$
  with pt as (
    select st_setsrid(st_makepoint(lng, lat), 4326) as g
  )
  select z.id, z.slug, z.name, r.id, r.slug, r.name
  from public.ad_zones z
  join public.ad_regions r on r.id = z.region_id
  cross join pt
  where r.is_active
    and (
      (z.boundary is not null and st_contains(z.boundary, pt.g))
      or (z.centroid is not null and st_dwithin(z.centroid::geography, pt.g::geography, 15000))
    )
  order by
    case when z.boundary is not null and st_contains(z.boundary, pt.g) then 0 else 1 end,
    st_distance(z.centroid::geography, pt.g::geography)
  limit 1;
$$;

comment on function public.resolve_geo is 'Zone + region for a WGS84 point. Polygon match first, nearest-centroid (≤15 km) fallback until boundaries exist.';

-- ─── get_region_placements ───────────────────────────────────────────────────
-- Active sponsored placements for a region, in serving order:
-- exclusive → featured → premium. Only ACTIVE paid subscriptions serve.
create or replace function public.get_region_placements(p_region_id uuid)
returns table (
  slot_type     public.ad_slot_type,
  "position"    integer,
  dispensary_id uuid
)
language sql
stable
set search_path = public
as $$
  select s.slot_type, s.position, sub.dispensary_id
  from public.ad_slots s
  join public.ad_subscriptions sub on sub.slot_id = s.id and sub.status = 'active'
  where s.region_id = p_region_id
  order by
    case s.slot_type when 'exclusive' then 0 when 'featured' then 1 else 2 end,
    s.position;
$$;

comment on function public.get_region_placements is 'Active exclusive/featured/premium placements for a region, in serving order.';

-- ─── claim_slot ──────────────────────────────────────────────────────────────
-- Atomic slot claim. The partial unique index turns a double-claim into a
-- unique_violation, surfaced as SLOT_TAKEN. Server routes only (service role);
-- execute is revoked from client roles below, and RLS has no insert policy.
create or replace function public.claim_slot(
  p_slot_id uuid,
  p_dispensary_id uuid,
  p_price integer
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.ad_subscriptions (slot_id, dispensary_id, status, price_paid)
  values (p_slot_id, p_dispensary_id, 'pending', p_price)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'SLOT_TAKEN';
end;
$$;

comment on function public.claim_slot is 'Insert a pending claim on a slot; raises SLOT_TAKEN when the slot has a live subscription.';

-- ─── release_stale_ad_claims ─────────────────────────────────────────────────
-- Abandoned checkouts must release their slot: cancel `pending` claims older
-- than 30 minutes that never got a Stripe subscription attached. Called by the
-- cron route and defensively before each new claim.
create or replace function public.release_stale_ad_claims()
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.ad_subscriptions
  set status = 'canceled', ends_at = now()
  where status = 'pending'
    and stripe_subscription_id is null
    and created_at < now() - interval '30 minutes';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.release_stale_ad_claims is 'Cancels pending claims older than 30 min with no Stripe subscription, freeing their slots.';

-- Clients may resolve geo and read placements; claims/releases are server-only.
revoke execute on function public.claim_slot(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.release_stale_ad_claims() from public, anon, authenticated;
grant execute on function public.resolve_geo(float8, float8) to anon, authenticated;
grant execute on function public.get_region_placements(uuid) to anon, authenticated;
