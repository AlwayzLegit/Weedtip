-- ════════════════════════════════════════════════════════════════════════════
-- 20260714120000_search_bounds_deals_filter
--
-- Adds a `filter_has_deals` boolean to search_dispensaries_bounds so the
-- listing can offer a top-level "Deals" filter pill (Weedmaps parity). When
-- true, only dispensaries with a currently-live deal (active + within its
-- start/end window) are returned. Drop + recreate because the argument list
-- grows; grants are re-applied.
-- ════════════════════════════════════════════════════════════════════════════

drop function if exists public.search_dispensaries_bounds(
  double precision, double precision, double precision, double precision, text,
  boolean, boolean, boolean, boolean, boolean, text, text[],
  double precision, double precision, text, integer, integer);

create function public.search_dispensaries_bounds(
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
  origin_lat double precision default null,
  origin_lng double precision default null,
  sort_by text default 'default',
  result_limit integer default 100,
  result_offset integer default 0,
  filter_has_deals boolean default null
)
returns table(
  id uuid, slug text, name text, city text, state character,
  cover_image_url text, logo_url text,
  is_medical boolean, is_recreational boolean, is_delivery boolean, is_pickup boolean,
  latitude double precision, longitude double precision,
  featured boolean, rating_avg numeric, rating_count integer, licensed boolean,
  distance_meters double precision, is_open_now boolean, total_count bigint
)
language plpgsql
stable
set search_path to 'public', 'extensions'
as $function$
declare
  origin geography := case
    when origin_lat is not null and origin_lng is not null
    then ST_SetSRID(ST_MakePoint(origin_lng, origin_lat), 4326)::geography
    else null
  end;
  tsq tsquery := case
    when search_query is null or btrim(search_query) = ''
    then null
    else websearch_to_tsquery('english', search_query)
  end;
begin
  return query
  with matched as (
    select
      d.*,
      case when origin is null then null else ST_Distance(d.location, origin) end as dist,
      public.is_dispensary_open(d.hours, d.timezone) as open_now,
      case when tsq is null then 0::real else ts_rank(d.search_vector, tsq) end as rank
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
      and (
        filter_category_slug is null
        or exists (
          select 1
          from public.products p
          join public.categories c on c.id = p.category_id
          where p.dispensary_id = d.id and c.slug = filter_category_slug
        )
      )
      and (
        filter_has_deals is not true
        or exists (
          select 1
          from public.deals dl
          where dl.dispensary_id = d.id
            and dl.is_active
            and dl.start_date <= now()
            and dl.end_date >= now()
        )
      )
  ),
  open_filtered as (
    select * from matched m
    where filter_open_now is not true or m.open_now
  )
  select
    o.id, o.slug, o.name, o.city, o.state,
    o.cover_image_url, o.logo_url,
    o.is_medical, o.is_recreational, o.is_delivery, o.is_pickup,
    o.latitude, o.longitude,
    o.featured, o.rating_avg, o.rating_count,
    (o.license_number is not null and o.license_number <> '') as licensed,
    o.dist as distance_meters, o.open_now as is_open_now,
    count(*) over () as total_count
  from open_filtered o
  order by
    case when sort_by = 'rating'   then o.rating_avg end desc nulls last,
    case when sort_by = 'rating'   then o.rating_count end desc nulls last,
    case when sort_by = 'name'     then o.name end asc nulls last,
    case when sort_by = 'distance' then o.dist end asc nulls last,
    o.featured desc,
    o.rank desc,
    o.dist asc nulls last,
    o.rating_avg desc,
    o.name asc
  limit least(greatest(coalesce(result_limit, 100), 0), 200)
  offset greatest(coalesce(result_offset, 0), 0);
end;
$function$;

grant execute on function public.search_dispensaries_bounds(
  double precision, double precision, double precision, double precision, text,
  boolean, boolean, boolean, boolean, boolean, text, text[],
  double precision, double precision, text, integer, integer, boolean
) to anon, authenticated;

-- Same filter on the map-pin projection so list and map stay consistent when
-- the Deals pill is on (this RPC already lateral-joins the live deal).
drop function if exists public.map_pins_bounds(
  double precision, double precision, double precision, double precision, text,
  boolean, boolean, boolean, boolean, boolean, text, text[], integer);

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
  featured boolean, is_open_now boolean, logo_url text, deal_type text, deal_value numeric
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
    deal.discount_value as deal_value
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
