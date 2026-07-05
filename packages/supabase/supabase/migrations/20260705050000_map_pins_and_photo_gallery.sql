-- ════════════════════════════════════════════════════════════════════════════
-- 20260705050000_map_pins_and_photo_gallery
-- Map upgrade round 2:
-- 1. map_pins_bounds — a pin-sized projection of search_dispensaries_bounds so
--    the map can plot EVERY shop in the viewport (clustered) while the result
--    list stays paginated. Same filters, tiny rows, hard cap.
-- 2. dispensaries.google_photo_names — all Google photo references (not just
--    the first), enabling the profile-page photo gallery. Populated by the
--    admin enrichment console; the photo API route falls back to live lookup.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

alter table public.dispensaries add column if not exists google_photo_names text[];

create or replace function public.map_pins_bounds(
  min_lat               double precision,
  min_lng               double precision,
  max_lat               double precision,
  max_lng               double precision,
  search_query          text default null,
  filter_delivery       boolean default null,
  filter_pickup         boolean default null,
  filter_medical        boolean default null,
  filter_recreational   boolean default null,
  filter_open_now       boolean default false,
  filter_category_slug  text default null,
  filter_amenities      text[] default null,
  result_limit          integer default 3000
)
returns table (
  slug text, name text, latitude double precision, longitude double precision,
  featured boolean, is_open_now boolean
)
language plpgsql stable set search_path = public, extensions
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
    d.featured, public.is_dispensary_open(d.hours, d.timezone) as is_open_now
  from public.dispensaries d
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
  double precision, double precision, double precision, double precision,
  text, boolean, boolean, boolean, boolean, boolean, text, text[], integer
) to anon, authenticated;
