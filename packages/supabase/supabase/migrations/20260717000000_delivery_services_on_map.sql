-- ════════════════════════════════════════════════════════════════════════════
-- 20260717000000_delivery_services_on_map
--
-- All 221 delivery-only services carry a county but no coordinates, so the
-- bounds-based map RPCs could never return them — they were invisible on
-- /dispensaries AND /deliveries. Weedmaps solves this by pinning delivery
-- services to their service area; do the same:
--
--   1. `location_approximate` flag: the pin marks a service AREA, not a
--      storefront (UI suppresses directions / exact-address affordances).
--   2. Backfill delivery-only rows from ad_zones county centroids where a
--      zone exists, else from a county-seat lookup (all CA counties in the
--      data). A small deterministic per-row jitter (~±3km) spreads same-county
--      services so they don't stack on one point.
--   3. map_pins_bounds returns `delivery_only` so the map can draw the
--      Weedmaps-style distinct delivery pin.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.dispensaries
  add column if not exists location_approximate boolean not null default false;

-- Seeded ad-zone centroids first (best available service-area geometry).
update public.dispensaries d
set location = ST_SetSRID(
      ST_MakePoint(
        ST_X(z.centroid::geometry) + ((hashtext(d.id::text) % 100) / 100.0) * 0.06,
        ST_Y(z.centroid::geometry) + ((hashtext(d.id::text || 'lat') % 100) / 100.0) * 0.06
      ), 4326)::geography,
    location_approximate = true
from public.ad_zones z
where d.is_delivery
  and not d.is_pickup
  and d.location is null
  and d.county is not null
  and (lower(z.name) = lower(d.county) or lower(z.name) = lower(d.county || ' county'));

-- County-seat fallback for counties without a seeded zone.
update public.dispensaries d
set location = ST_SetSRID(
      ST_MakePoint(
        s.lng + ((hashtext(d.id::text) % 100) / 100.0) * 0.06,
        s.lat + ((hashtext(d.id::text || 'lat') % 100) / 100.0) * 0.06
      ), 4326)::geography,
    location_approximate = true
from (
  values
    ('Contra Costa', 37.978, -122.031),
    ('Humboldt', 40.802, -124.164),
    ('Kern', 35.373, -119.019),
    ('Los Angeles', 34.054, -118.243),
    ('Marin', 37.973, -122.531),
    ('San Joaquin', 37.958, -121.291),
    ('San Mateo', 37.485, -122.236),
    ('Santa Clara', 37.338, -121.886),
    ('Stanislaus', 37.639, -120.997),
    ('Yolo', 38.679, -121.773)
) as s(county, lat, lng)
where d.is_delivery
  and not d.is_pickup
  and d.location is null
  and d.state = 'CA'
  and lower(d.county) = lower(s.county);

-- Pins RPC: add delivery_only so the map can style delivery pins distinctly.
-- Return type changes, so drop + recreate and re-grant.
drop function if exists public.map_pins_bounds(
  double precision, double precision, double precision, double precision, text,
  boolean, boolean, boolean, boolean, boolean, text, text[], integer, boolean);

create function public.map_pins_bounds(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision,
  search_query text default null,
  filter_delivery boolean default null,
  filter_pickup boolean default null,
  filter_medical boolean default null,
  filter_recreational boolean default null,
  filter_open_now boolean default false,
  filter_category_slug text default null,
  filter_amenities text[] default null,
  result_limit integer default 3000,
  filter_has_deals boolean default null
)
returns table(
  slug text, name text, latitude double precision, longitude double precision,
  featured boolean, is_open_now boolean, logo_url text, deal_type text, deal_value numeric,
  delivery_only boolean
)
language plpgsql
stable
set search_path to 'public', 'extensions'
as $function$
declare
  tsq tsquery := case
    when search_query is null or btrim(search_query) = ''
    then null
    else websearch_to_tsquery('english', search_query)
  end;
begin
  return query
  select
    d.slug, d.name, d.latitude, d.longitude,
    d.featured, public.is_dispensary_open(d.hours, d.timezone) as is_open_now,
    case when d.featured then d.logo_url end as logo_url,
    deal.discount_type as deal_type,
    deal.discount_value as deal_value,
    (d.is_delivery and not d.is_pickup) as delivery_only
  from public.dispensaries d
  left join lateral (
    select dl.discount_type, dl.discount_value
    from public.deals dl
    where dl.dispensary_id = d.id
      and dl.is_active
      and dl.start_date <= now()
      and dl.end_date >= now()
    order by dl.end_date asc
    limit 1
  ) deal on true
  where d.status = 'active'
    and d.latitude  between least(min_lat, max_lat) and greatest(min_lat, max_lat)
    and d.longitude between least(min_lng, max_lng) and greatest(min_lng, max_lng)
    and (tsq is null or d.search_vector @@ tsq)
    and (filter_delivery is null or d.is_delivery = filter_delivery)
    and (filter_pickup is null or d.is_pickup = filter_pickup)
    and (filter_medical is null or d.is_medical = filter_medical)
    and (filter_recreational is null or d.is_recreational = filter_recreational)
    and (filter_amenities is null or d.amenities @> filter_amenities)
    and (filter_open_now is not true or public.is_dispensary_open(d.hours, d.timezone))
    and (filter_has_deals is not true or deal.discount_type is not null)
    and (
      filter_category_slug is null
      or exists (
        select 1
        from public.products p
        join public.categories c on c.id = p.category_id
        where p.dispensary_id = d.id and c.slug = filter_category_slug
      )
    )
  order by d.featured desc, d.rating_count desc, d.slug asc
  limit least(greatest(coalesce(result_limit, 3000), 0), 4000);
end;
$function$;

grant execute on function public.map_pins_bounds(
  double precision, double precision, double precision, double precision, text,
  boolean, boolean, boolean, boolean, boolean, text, text[], integer, boolean
) to anon, authenticated;
