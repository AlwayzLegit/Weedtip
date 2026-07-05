-- 20260705110001_ad_boundaries
-- Starter boundaries for every zone and region (Phase 4).
--
-- Zones get a ~2.5 km disc around their community centroid — the handoff's
-- "rough polygons, precision matters at zone level only" starting point.
-- Regions get the convex hull of their member-zone discs, which guarantees
-- every seeded community sits inside its own region with zero hand-fitting
-- errors. Hand-refined freeway-aligned GeoJSON can replace any of these at
-- any time through the admin console's boundary editor
-- (admin_set_ad_boundary), which is the Phase 4 tool built for exactly that.
--
-- resolve_geo() already prefers polygon containment and tie-breaks
-- overlapping discs by centroid distance, so adjacent-zone overlap is fine.

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
