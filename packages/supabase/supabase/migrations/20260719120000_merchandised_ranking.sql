-- ════════════════════════════════════════════════════════════════════════════
-- 20260719120000_merchandised_ranking
--
-- Weedmaps-style merchandising for browse/map results. Until now the ONLY
-- ranking boost was the admin `featured` flag — paying subscribers ranked the
-- same as free listings. Both search RPCs now compute `paid_tier` (0-2):
--   greatest( max active PAID subscription tier, any active placement → 1 )
-- Grandfathered listings deliberately do NOT boost — grandfathering unlocks
-- features, merchandising rewards actual spend.
--
-- Default ordering becomes: featured → paid_tier → text rank → distance →
-- rating → name. In the bounds RPC an EXPLICIT sort_by (rating/reviewed/name/
-- distance) still wins over merchandising — a user-chosen sort stays honest.
--
-- `paid_tier` is returned so the UI can label results ("Sponsored") and give
-- paid pins the logo treatment. Return type changes → drop + recreate + regrant.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

drop function if exists public.search_dispensaries(text, double precision, double precision, double precision, boolean, boolean, boolean, boolean, boolean, text, text[], integer, integer);

create function public.search_dispensaries(
  search_query text default null,
  lat double precision default null,
  lng double precision default null,
  radius_meters double precision default 40000,
  filter_delivery boolean default null,
  filter_pickup boolean default null,
  filter_medical boolean default null,
  filter_recreational boolean default null,
  filter_open_now boolean default false,
  filter_category_slug text default null,
  filter_amenities text[] default null,
  result_limit integer default 20,
  result_offset integer default 0
)
returns table(
  id uuid, owner_id uuid, name text, slug text, description text, address text,
  city text, state character, zip text, phone text, email text, website text,
  logo_url text, cover_image_url text, license_number text,
  is_medical boolean, is_recreational boolean, is_delivery boolean, is_pickup boolean,
  hours jsonb, latitude double precision, longitude double precision,
  status dispensary_status, featured boolean, rating_avg numeric, rating_count integer,
  created_at timestamptz, updated_at timestamptz,
  distance_meters double precision, is_open_now boolean, rank real,
  paid_tier integer, total_count bigint
)
language plpgsql
stable
set search_path to 'public', 'extensions'
as $function$
declare
  origin geography := case
    when lat is not null and lng is not null
    then ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    else null
  end;
  tsq tsquery := case
    when search_query is null or btrim(search_query) = ''
    then null
    else websearch_to_tsquery('english', search_query)
  end;
begin
  return query
  with paid as (
    select s.dispensary_id, max(pl.tier)::int as tier
    from public.dispensary_subscriptions s
    join public.plans pl on pl.id = s.plan_id
    where s.status = 'active' and pl.price_cents > 0
      and (s.current_period_end is null or s.current_period_end >= now())
    group by 1
  ),
  promoted as (
    select p.dispensary_id
    from public.placements p
    where p.dispensary_id is not null and p.is_active
      and p.starts_at <= now() and (p.ends_at is null or p.ends_at >= now())
    group by 1
  ),
  matched as (
    select
      d.*,
      case when origin is null then null else ST_Distance(d.location, origin) end as distance_meters,
      public.is_dispensary_open(d.hours, d.timezone) as is_open_now,
      case when tsq is null then 0::real else ts_rank(d.search_vector, tsq) end as rank,
      greatest(
        coalesce(pd.tier, 0),
        case when pr.dispensary_id is not null then 1 else 0 end
      ) as paid_tier
    from public.dispensaries d
    left join paid pd on pd.dispensary_id = d.id
    left join promoted pr on pr.dispensary_id = d.id
    where d.status = 'active'
      and (tsq is null or d.search_vector @@ tsq)
      and (origin is null or ST_DWithin(d.location, origin, radius_meters))
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
  ),
  open_filtered as (
    select * from matched m
    where filter_open_now is not true or m.is_open_now
  )
  select
    o.id, o.owner_id, o.name, o.slug, o.description, o.address, o.city, o.state, o.zip,
    o.phone, o.email, o.website, o.logo_url, o.cover_image_url, o.license_number,
    o.is_medical, o.is_recreational, o.is_delivery, o.is_pickup, o.hours,
    ST_Y(o.location::geometry) as latitude,
    ST_X(o.location::geometry) as longitude,
    o.status, o.featured, o.rating_avg, o.rating_count, o.created_at, o.updated_at,
    o.distance_meters, o.is_open_now, o.rank, o.paid_tier,
    count(*) over () as total_count
  from open_filtered o
  order by
    o.featured desc,
    o.paid_tier desc,
    o.rank desc,
    o.distance_meters asc nulls last,
    o.rating_avg desc nulls last,
    o.name asc
  limit greatest(coalesce(result_limit, 20), 0)
  offset greatest(coalesce(result_offset, 0), 0);
end;
$function$;

revoke all on function public.search_dispensaries(text, double precision, double precision, double precision, boolean, boolean, boolean, boolean, boolean, text, text[], integer, integer) from public;
grant execute on function public.search_dispensaries(text, double precision, double precision, double precision, boolean, boolean, boolean, boolean, boolean, text, text[], integer, integer) to anon, authenticated;

drop function if exists public.search_dispensaries_bounds(double precision, double precision, double precision, double precision, text, boolean, boolean, boolean, boolean, boolean, text, text[], double precision, double precision, text, integer, integer, boolean);

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
  distance_meters double precision, is_open_now boolean,
  paid_tier integer, total_count bigint
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
  with paid as (
    select s.dispensary_id, max(pl.tier)::int as tier
    from public.dispensary_subscriptions s
    join public.plans pl on pl.id = s.plan_id
    where s.status = 'active' and pl.price_cents > 0
      and (s.current_period_end is null or s.current_period_end >= now())
    group by 1
  ),
  promoted as (
    select p.dispensary_id
    from public.placements p
    where p.dispensary_id is not null and p.is_active
      and p.starts_at <= now() and (p.ends_at is null or p.ends_at >= now())
    group by 1
  ),
  matched as (
    select
      d.*,
      case when origin is null then null else ST_Distance(d.location, origin) end as dist,
      public.is_dispensary_open(d.hours, d.timezone) as open_now,
      case when tsq is null then 0::real else ts_rank(d.search_vector, tsq) end as rank,
      greatest(
        coalesce(pd.tier, 0),
        case when pr.dispensary_id is not null then 1 else 0 end
      ) as ptier
    from public.dispensaries d
    left join paid pd on pd.dispensary_id = d.id
    left join promoted pr on pr.dispensary_id = d.id
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
    o.ptier as paid_tier,
    count(*) over () as total_count
  from open_filtered o
  order by
    case when sort_by = 'rating'   then o.rating_avg end desc nulls last,
    case when sort_by = 'rating'   then o.rating_count end desc nulls last,
    case when sort_by = 'reviewed' then o.rating_count end desc nulls last,
    case when sort_by = 'reviewed' then o.rating_avg end desc nulls last,
    case when sort_by = 'name'     then o.name end asc nulls last,
    case when sort_by = 'distance' then o.dist end asc nulls last,
    o.featured desc,
    o.ptier desc,
    o.rank desc,
    o.dist asc nulls last,
    o.rating_avg desc nulls last,
    o.name asc
  limit least(greatest(coalesce(result_limit, 100), 0), 200)
  offset greatest(coalesce(result_offset, 0), 0);
end;
$function$;

revoke all on function public.search_dispensaries_bounds(double precision, double precision, double precision, double precision, text, boolean, boolean, boolean, boolean, boolean, text, text[], double precision, double precision, text, integer, integer, boolean) from public;
grant execute on function public.search_dispensaries_bounds(double precision, double precision, double precision, double precision, text, boolean, boolean, boolean, boolean, boolean, text, text[], double precision, double precision, text, integer, integer, boolean) to anon, authenticated;

-- Pins: paying shops get the branded logo-pin treatment too (was featured-only),
-- and rank above free pins when the viewport caps out.
drop function if exists public.map_pins_bounds(double precision, double precision, double precision, double precision, text, boolean, boolean, boolean, boolean, boolean, text, text[], integer, boolean);

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
  featured boolean, is_open_now boolean, logo_url text,
  deal_type text, deal_value numeric, delivery_only boolean, paid boolean
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
  with paid_ids as (
    select s.dispensary_id
    from public.dispensary_subscriptions s
    join public.plans pl on pl.id = s.plan_id
    where s.status = 'active' and pl.price_cents > 0
      and (s.current_period_end is null or s.current_period_end >= now())
    union
    select p.dispensary_id
    from public.placements p
    where p.dispensary_id is not null and p.is_active
      and p.starts_at <= now() and (p.ends_at is null or p.ends_at >= now())
  )
  select
    d.slug, d.name, d.latitude, d.longitude,
    d.featured, public.is_dispensary_open(d.hours, d.timezone) as is_open_now,
    case when d.featured or pi.dispensary_id is not null then d.logo_url end as logo_url,
    deal.discount_type as deal_type,
    deal.discount_value as deal_value,
    (d.is_delivery and not d.is_pickup) as delivery_only,
    (pi.dispensary_id is not null) as paid
  from public.dispensaries d
  left join paid_ids pi on pi.dispensary_id = d.id
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
  order by d.featured desc, (pi.dispensary_id is not null) desc, d.rating_count desc, d.slug asc
  limit least(greatest(coalesce(result_limit, 3000), 0), 4000);
end;
$function$;

revoke all on function public.map_pins_bounds(double precision, double precision, double precision, double precision, text, boolean, boolean, boolean, boolean, boolean, text, text[], integer, boolean) from public;
grant execute on function public.map_pins_bounds(double precision, double precision, double precision, double precision, text, boolean, boolean, boolean, boolean, boolean, text, text[], integer, boolean) to anon, authenticated;
