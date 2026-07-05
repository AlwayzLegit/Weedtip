-- ════════════════════════════════════════════════════════════════════════════
-- 20260705060000_map_pins_branding
-- Map round 3: pins carry merchandising. Featured shops return their logo (for
-- branded logo pins) and every pin returns its soonest-ending live deal (for
-- on-map "20% off" tags). Return type changes, so drop + recreate.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

drop function if exists public.map_pins_bounds(
  double precision, double precision, double precision, double precision,
  text, boolean, boolean, boolean, boolean, boolean, text, text[], integer
);

create function public.map_pins_bounds(
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
  featured boolean, is_open_now boolean,
  logo_url text, deal_type text, deal_value numeric
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
    d.featured, public.is_dispensary_open(d.hours, d.timezone) as is_open_now,
    -- Logo only for featured shops: they render as branded logo pins.
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
