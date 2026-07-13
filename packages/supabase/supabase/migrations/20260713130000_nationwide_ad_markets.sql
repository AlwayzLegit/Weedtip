-- ════════════════════════════════════════════════════════════════════════════
-- 20260713130000_nationwide_ad_markets
--
-- Expand the geographic ad system from one hand-built market (Los Angeles,
-- 18 regions / 73 zones) to full US coverage, derived from where supply
-- actually exists — the ~9,400 active dispensaries:
--
--   • One ad_market per state (LA keeps its own market; CA additionally gets
--     a 'california' market for everything outside LA's 15 km zone coverage).
--   • Advertiser REGIONS from density clustering (DBSCAN, 20 km, ≥3 shops)
--     per state. Metro clusters of 80+ shops are split into ~50-shop
--     territories with k-means so a Denver or Seattle sells as multiple
--     scarce regions (matching LA's density model), named by compass slice
--     ("Denver — Northeast"). Region tier follows shop density.
--   • Consumer ZONES from the cities inside each region (avg centroid).
--     resolve_geo() already falls back to nearest zone centroid within 15 km,
--     so centroids alone give working coverage; polygons can come later.
--   • Isolated shops (DBSCAN noise) roll up into one B-tier
--     "<State> — Other Areas" region per state, its cities as zones.
--   • Fixed slot inventory per new region: 1 exclusive + 3 featured +
--     10 premium (the price book in ad_products is tier-based and already
--     covers them).
--
-- Everything already covered by an existing zone centroid (≤15 km) is left
-- untouched, so re-running is safe (and all inserts are ON CONFLICT DO
-- NOTHING / guarded).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── State name lookup ───────────────────────────────────────────────────────
create temp table _state_names (code text primary key, name text not null);
insert into _state_names values
  ('AL','Alabama'),('AK','Alaska'),('AZ','Arizona'),('AR','Arkansas'),
  ('CA','California'),('CO','Colorado'),('CT','Connecticut'),('DE','Delaware'),
  ('DC','Washington DC'),('FL','Florida'),('GA','Georgia'),('HI','Hawaii'),
  ('ID','Idaho'),('IL','Illinois'),('IN','Indiana'),('IA','Iowa'),
  ('KS','Kansas'),('KY','Kentucky'),('LA','Louisiana'),('ME','Maine'),
  ('MD','Maryland'),('MA','Massachusetts'),('MI','Michigan'),('MN','Minnesota'),
  ('MS','Mississippi'),('MO','Missouri'),('MT','Montana'),('NE','Nebraska'),
  ('NV','Nevada'),('NH','New Hampshire'),('NJ','New Jersey'),('NM','New Mexico'),
  ('NY','New York'),('NC','North Carolina'),('ND','North Dakota'),('OH','Ohio'),
  ('OK','Oklahoma'),('OR','Oregon'),('PA','Pennsylvania'),('PR','Puerto Rico'),
  ('RI','Rhode Island'),('SC','South Carolina'),('SD','South Dakota'),
  ('TN','Tennessee'),('TX','Texas'),('UT','Utah'),('VT','Vermont'),
  ('VA','Virginia'),('WA','Washington'),('WV','West Virginia'),
  ('WI','Wisconsin'),('WY','Wyoming');

-- ─── Cluster the supply ──────────────────────────────────────────────────────
do $$
declare
  rec record;
  k integer;
begin
  -- Active, geocoded shops not already served by an existing zone centroid.
  create temp table _pts as
  select d.id, d.state,
         coalesce(nullif(trim(d.city), ''), 'Area') as city,
         d.longitude as lng, d.latitude as lat,
         st_transform(st_setsrid(st_makepoint(d.longitude, d.latitude), 4326), 3857) as geom_m
  from public.dispensaries d
  where d.status = 'active'
    and d.latitude is not null and d.longitude is not null
    and exists (select 1 from _state_names sn where sn.code = d.state)
    and not exists (
      select 1 from public.ad_zones z
      where z.centroid is not null
        and st_dwithin(
              st_setsrid(st_makepoint(d.longitude, d.latitude), 4326)::geography,
              z.centroid::geography,
              15000)
    );

  -- Level 1: density clusters per state (20 km reach, ≥3 shops). NULL cid =
  -- isolated shops that roll up into the state's "Other Areas" region.
  create temp table _c1 as
  select p.*,
         st_clusterdbscan(p.geom_m, eps := 20000, minpoints := 3)
           over (partition by p.state) as cid,
         0 as subcid
  from _pts p;

  -- Level 2: split 80+ shop metros into ~50-shop sellable territories.
  for rec in
    select state, cid, count(*)::int as n
    from _c1 where cid is not null
    group by state, cid
    having count(*) >= 80
  loop
    k := ceil(rec.n / 50.0);
    update _c1 c
    set subcid = km.sk
    from (
      select id, st_clusterkmeans(geom_m, k) over () as sk
      from _c1
      where state = rec.state and cid = rec.cid
    ) km
    where c.id = km.id;
  end loop;
end $$;

-- ─── Stage regions (metro clusters + per-state catch-alls) ───────────────────
create temp table _regions as
with sub as (
  select state, cid, subcid,
         count(*)::int as n,
         mode() within group (order by city) as anchor,
         avg(lng) as lng, avg(lat) as lat
  from _c1
  where cid is not null
  group by state, cid, subcid
),
parent as (
  select state, cid, avg(lng) as plng, avg(lat) as plat, count(*)::int as pieces
  from sub group by state, cid
),
-- Compass label for split-metro pieces, from the piece's bearing off the
-- metro centroid. The largest piece keeps the plain anchor name.
named as (
  select s.*,
    case
      when p.pieces = 1
        or row_number() over (partition by s.state, s.cid order by s.n desc, s.subcid) = 1
      then s.anchor
      else s.anchor || ' — ' || (
        case
          when a < 22.5  then 'North'
          when a < 67.5  then 'Northeast'
          when a < 112.5 then 'East'
          when a < 157.5 then 'Southeast'
          when a < 202.5 then 'South'
          when a < 247.5 then 'Southwest'
          when a < 292.5 then 'West'
          when a < 337.5 then 'Northwest'
          else 'North'
        end)
    end as base_name
  from sub s
  join parent p using (state, cid)
  cross join lateral (
    select mod(cast(degrees(atan2(s.lng - p.plng, s.lat - p.plat)) + 360 as numeric), 360) as a
  ) bearing
),
-- Same name twice in a state (two "Springfield" clusters, twin compass
-- slices) → numeric suffix on the later ones.
deduped as (
  select *,
    base_name
      || case when row_number() over (partition by state, base_name order by n desc, subcid) > 1
              then ' ' || row_number() over (partition by state, base_name order by n desc, subcid)::text
              else '' end as name
  from named
)
select
  state, cid, subcid, n, name,
  lower(state) || '-' ||
    trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) as slug,
  case when n >= 60 then 'A_PLUS' when n >= 30 then 'A'
       when n >= 12 then 'B_PLUS' else 'B' end as tier,
  row_number() over (partition by state order by n desc, name)::int as sort_order,
  false as is_catchall
from deduped;

-- Catch-alls: every state with isolated shops gets one B-tier region.
insert into _regions (state, cid, subcid, n, name, slug, tier, sort_order, is_catchall)
select c.state, null, 0, count(*)::int,
       sn.name || ' — Other Areas',
       lower(c.state) || '-other-areas',
       'B', 999, true
from _c1 c
join _state_names sn on sn.code = c.state
where c.cid is null
group by c.state, sn.name;

-- ─── Markets: one per state involved ─────────────────────────────────────────
insert into public.ad_markets (slug, name, state)
select distinct
  trim(both '-' from regexp_replace(lower(sn.name), '[^a-z0-9]+', '-', 'g')),
  sn.name, r.state
from _regions r
join _state_names sn on sn.code = r.state
on conflict (slug) do nothing;

-- ─── Regions, with tier-based exclusive bands (cents/month) ──────────────────
insert into public.ad_regions
  (market_id, slug, name, tier, exclusive_price_min, exclusive_price_max, sort_order)
select
  m.id, r.slug, r.name, r.tier::public.region_tier,
  case r.tier when 'A_PLUS' then 500000 when 'A' then 350000 else 200000 end,
  case r.tier when 'A_PLUS' then 1000000 when 'A' then 750000 else 500000 end,
  r.sort_order
from _regions r
join _state_names sn on sn.code = r.state
join public.ad_markets m
  on m.slug = trim(both '-' from regexp_replace(lower(sn.name), '[^a-z0-9]+', '-', 'g'))
on conflict (slug) do nothing;

-- ─── Zones: the cities inside each region, avg-centroid per city ─────────────
with zc as (
  -- Metro-region cities
  select c.state, c.cid, c.subcid,
         mode() within group (order by c.city) as city_name,
         count(*)::int as n,
         avg(c.lng) as lng, avg(c.lat) as lat
  from _c1 c
  where c.cid is not null
  group by c.state, c.cid, c.subcid, lower(c.city)
  union all
  -- Catch-all cities (isolated shops)
  select c.state, null, 0,
         mode() within group (order by c.city),
         count(*)::int, avg(c.lng), avg(c.lat)
  from _c1 c
  where c.cid is null
  group by c.state, lower(c.city)
),
joined as (
  select z.*, r.slug as region_slug,
         lower(z.state) || '-' ||
           trim(both '-' from regexp_replace(lower(z.city_name), '[^a-z0-9]+', '-', 'g'))
           as base_slug
  from zc z
  join _regions r
    on r.state = z.state
   and r.cid is not distinct from z.cid
   and r.subcid = z.subcid
),
final as (
  -- Same city in several regions of a state (split metros: "Denver" appears
  -- in every Denver slice) → numeric suffix keeps zone slugs unique.
  select *,
    base_slug
      || case when row_number() over (partition by base_slug order by n desc) > 1
              then '-' || row_number() over (partition by base_slug order by n desc)::text
              else '' end as slug
  from joined
)
insert into public.ad_zones (region_id, slug, name, centroid)
select ar.id, f.slug, f.city_name, st_setsrid(st_makepoint(f.lng, f.lat), 4326)
from final f
join public.ad_regions ar on ar.slug = f.region_slug
on conflict (slug) do nothing;

-- ─── Fixed slot inventory for every region that has none ─────────────────────
insert into public.ad_slots (region_id, slot_type, position)
select r.id, s.slot_type::public.ad_slot_type, s.position
from public.ad_regions r
cross join (
  values ('exclusive', 1),
         ('featured', 1), ('featured', 2), ('featured', 3),
         ('premium', 1), ('premium', 2), ('premium', 3), ('premium', 4),
         ('premium', 5), ('premium', 6), ('premium', 7), ('premium', 8),
         ('premium', 9), ('premium', 10)
) as s(slot_type, position)
where not exists (select 1 from public.ad_slots sl where sl.region_id = r.id)
on conflict (region_id, slot_type, position) do nothing;

drop table if exists _regions;
drop table if exists _c1;
drop table if exists _pts;
drop table if exists _state_names;
