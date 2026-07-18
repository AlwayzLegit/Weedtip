-- ════════════════════════════════════════════════════════════════════════════
-- 20260719130000_ad_boundaries_backfill
--
-- AUDIT FINDING (user-reported "wrong data" on /advertise, confirmed): the
-- nationwide ad-inventory re-seed (2026-07-13: 43 markets / 542 regions /
-- 2,891 zones) ran AFTER the original starter-boundary migration
-- (20260705110001), so the re-seeded rows never got boundary polygons —
-- 2,818/2,891 zones and 524/542 regions had boundary IS NULL. Anything that
-- resolves ads by polygon containment silently fell through to the
-- centroid-distance fallback for 97% of inventory.
--
-- What IS correct (verified against prod): market→state assignment (0 regions
-- whose contained shops' dominant state mismatches), and zone names/centroids
-- (12/12 random zones' names match the dispensary cities within 10 km).
--
-- Fix: re-run the exact starter-boundary logic — zones get a ~2.5 km disc
-- around their centroid, regions get the convex hull of their member-zone
-- discs. Idempotent (fills NULLs only); hand-refined GeoJSON via the admin
-- boundary editor still wins whenever set.
-- ════════════════════════════════════════════════════════════════════════════
-- (PostGIS types live in the extensions schema — it must be on the path.)
set search_path = public, extensions;

update public.ad_zones
set boundary = st_multi(st_buffer(centroid::geography, 2500)::geometry)
where centroid is not null and boundary is null;

update public.ad_regions r
set boundary = z.hull
from (
  select region_id, st_multi(st_convexhull(st_collect(boundary))) as hull
  from public.ad_zones
  where boundary is not null
  group by region_id
) z
where z.region_id = r.id and r.boundary is null;

-- Every generated boundary must be valid; fail the migration loudly if not.
do $$
begin
  if exists (select 1 from public.ad_zones where boundary is not null and not st_isvalid(boundary))
     or exists (select 1 from public.ad_regions where boundary is not null and not st_isvalid(boundary)) then
    raise exception 'Generated ad boundary failed ST_IsValid';
  end if;
end $$;
