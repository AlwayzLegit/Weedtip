-- ════════════════════════════════════════════════════════════════════════════
-- 20260724220000_bounds_search_google_rating
--
-- The map browser is the directory's main discovery surface, and it ranked and
-- displayed ONLY rating_avg / rating_count — Weedtip's own reviews. With one
-- rated shop out of 9,110, every result read as unrated and the "Top rated"
-- sort was meaningless.
--
-- The bounds search now computes an EFFECTIVE rating with the same precedence
-- the app uses (lib/google-rating.ts):
--   1. Weedtip reviews when they exist  — first-party, what we want shops to earn
--   2. otherwise the imported Google rating, but only inside the 30-day window
--      Google Maps Platform permits us to cache Places content for
--   3. otherwise nothing — a stale rating is treated as absent, not shown
--
-- `rating_source` is returned alongside so the UI can label a Google-sourced
-- number as Google's. rating_avg / rating_count keep their original meaning for
-- callers that specifically want first-party numbers.
--
-- Return type changes → drop + recreate + regrant.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

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
  paid_tier integer,
  display_rating numeric, display_rating_count integer, rating_source text,
  google_maps_uri text,
  total_count bigint
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
  -- Mirrors GOOGLE_RATING_TTL_DAYS in the app.
  google_cutoff timestamptz := now() - interval '30 days';
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
      ) as ptier,
      -- Weedtip reviews win; a Google rating fills in only while fresh.
      case
        when d.rating_count > 0 and d.rating_avg > 0 then 'weedtip'
        when coalesce(d.google_rating, 0) > 0
         and coalesce(d.google_rating_count, 0) > 0
         and d.google_rating_at is not null
         and d.google_rating_at >= google_cutoff then 'google'
      end as rsource
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
    select
      m.*,
      case m.rsource
        when 'weedtip' then m.rating_avg
        when 'google' then m.google_rating
      end as eff_rating,
      case m.rsource
        when 'weedtip' then m.rating_count
        when 'google' then m.google_rating_count
      end as eff_rating_count
    from matched m
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
    o.eff_rating as display_rating,
    o.eff_rating_count as display_rating_count,
    o.rsource as rating_source,
    -- Attribution target; only meaningful when rating_source = 'google'.
    case when o.rsource = 'google' then o.google_maps_uri end as google_maps_uri,
    count(*) over () as total_count
  from open_filtered o
  order by
    case when sort_by = 'rating'   then o.eff_rating end desc nulls last,
    case when sort_by = 'rating'   then o.eff_rating_count end desc nulls last,
    case when sort_by = 'reviewed' then o.eff_rating_count end desc nulls last,
    case when sort_by = 'reviewed' then o.eff_rating end desc nulls last,
    case when sort_by = 'name'     then o.name end asc nulls last,
    case when sort_by = 'distance' then o.dist end asc nulls last,
    o.featured desc,
    o.ptier desc,
    o.rank desc,
    o.dist asc nulls last,
    o.eff_rating desc nulls last,
    o.name asc
  limit least(greatest(coalesce(result_limit, 100), 0), 200)
  offset greatest(coalesce(result_offset, 0), 0);
end;
$function$;

revoke all on function public.search_dispensaries_bounds(double precision, double precision, double precision, double precision, text, boolean, boolean, boolean, boolean, boolean, text, text[], double precision, double precision, text, integer, integer, boolean) from public;
grant execute on function public.search_dispensaries_bounds(double precision, double precision, double precision, double precision, text, boolean, boolean, boolean, boolean, boolean, text, text[], double precision, double precision, text, integer, integer, boolean) to anon, authenticated;

-- Pins cap out at 3,000 per viewport and drop the least-established shops
-- first; that tiebreak now counts Google ratings too, so a well-rated shop
-- with no Weedtip reviews yet isn't the first pin to disappear.
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
  google_cutoff timestamptz := now() - interval '30 days';
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
  order by
    d.featured desc,
    (pi.dispensary_id is not null) desc,
    greatest(
      d.rating_count,
      case
        when coalesce(d.google_rating, 0) > 0
         and d.google_rating_at is not null
         and d.google_rating_at >= google_cutoff
        then coalesce(d.google_rating_count, 0)
        else 0
      end
    ) desc,
    d.slug asc
  limit least(greatest(coalesce(result_limit, 3000), 0), 4000);
end;
$function$;

revoke all on function public.map_pins_bounds(double precision, double precision, double precision, double precision, text, boolean, boolean, boolean, boolean, boolean, text, text[], integer, boolean) from public;
grant execute on function public.map_pins_bounds(double precision, double precision, double precision, double precision, text, boolean, boolean, boolean, boolean, boolean, text, text[], integer, boolean) to anon, authenticated;
