-- ════════════════════════════════════════════════════════════════════════════
-- 20260713130001_ad_scale_rpcs
--
-- Nationwide coverage grows ad_slots to ~7k rows and ad_zones to ~3k — past
-- PostgREST's 1,000-row response cap. The app queries that used to fetch
-- whole tables and aggregate in JS (getSlotAvailability, the /advertise zone
-- chips) would silently truncate, so aggregate in the database instead: both
-- functions return one row per region (well under the cap).
--
-- ad_slot_availability() is SECURITY DEFINER because open-slot counts must
-- include PENDING checkout holds (scarcity is the sales pitch), and pending
-- ad_subscriptions rows are not publicly readable under RLS. Only aggregate
-- counts are exposed — never who holds a slot.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.ad_slot_availability()
returns table (
  region_id      uuid,
  exclusive_open boolean,
  featured_open  integer,
  premium_open   integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.region_id,
    coalesce(bool_or(s.slot_type = 'exclusive' and live.slot_id is null), false),
    count(*) filter (where s.slot_type = 'featured' and live.slot_id is null)::int,
    count(*) filter (where s.slot_type = 'premium'  and live.slot_id is null)::int
  from public.ad_slots s
  left join lateral (
    select sub.slot_id
    from public.ad_subscriptions sub
    where sub.slot_id = s.id
      and sub.status in ('pending', 'active', 'past_due')
    limit 1
  ) live on true
  group by s.region_id;
$$;

revoke all on function public.ad_slot_availability() from public;
grant execute on function public.ad_slot_availability() to anon, authenticated;

comment on function public.ad_slot_availability is
  'Open-slot counts per region (pending holds count as taken). One row per region — safe from the PostgREST row cap that whole-table reads hit at nationwide scale.';

-- Zone names per region for the /advertise cards. Public data (ad_zones is
-- public-read); aggregation just keeps the response at one row per region.
create or replace function public.ad_region_zone_names()
returns table (region_id uuid, zone_names text[])
language sql
stable
as $$
  select z.region_id, array_agg(z.name order by z.name)
  from public.ad_zones z
  group by z.region_id;
$$;

grant execute on function public.ad_region_zone_names() to anon, authenticated;

comment on function public.ad_region_zone_names is
  'Zone display names aggregated per region, so /advertise never pulls the whole ad_zones table through the row cap.';
