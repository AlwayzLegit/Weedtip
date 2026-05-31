-- ════════════════════════════════════════════════════════════════════════════
-- 20260530000007_dispensary_coords
-- Expose latitude/longitude as generated columns derived from the PostGIS
-- `location`. Lets clients (web edit forms, mobile) read coordinates directly
-- without parsing geography WKB. `location` remains the source of truth; these
-- are always consistent because they're STORED generated columns.
-- ST_X/ST_Y over a geometry cast are IMMUTABLE, so they're valid in generated cols.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

alter table public.dispensaries
  add column latitude double precision
    generated always as (ST_Y(location::geometry)) stored,
  add column longitude double precision
    generated always as (ST_X(location::geometry)) stored;

comment on column public.dispensaries.latitude is 'Derived from location (read-only). Write via location.';
comment on column public.dispensaries.longitude is 'Derived from location (read-only). Write via location.';
