-- ════════════════════════════════════════════════════════════════════════════
-- 20260704060000_dispensary_timezone
-- Audit finding #5 (high): open-now was evaluated in the SESSION timezone (UTC)
-- by is_dispensary_open() — which drives the /dispensaries "Open now" filter via
-- search_dispensaries — while the dispensary detail page hardcoded Pacific. Both
-- are wrong once shops span 6 US timezones, and they disagree with each other.
--
-- Fix: store an IANA timezone per dispensary (derived from state, refined by
-- longitude for the split states that matter most — FL panhandle, TX El Paso),
-- evaluate hours in that zone, and keep it populated on insert/update.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

-- Primary US timezone by state, with longitude refinement for the two biggest
-- split-state cases. Everything not listed is Eastern.
create or replace function public.us_state_timezone(p_state text, p_lng double precision default null)
returns text language sql immutable as $function$
  select case upper(coalesce(p_state, ''))
    when 'FL' then case when p_lng is not null and p_lng < -85.0   then 'America/Chicago' else 'America/New_York' end
    when 'TX' then case when p_lng is not null and p_lng < -104.9  then 'America/Denver'  else 'America/Chicago'  end
    when 'CA' then 'America/Los_Angeles'
    when 'NV' then 'America/Los_Angeles'
    when 'OR' then 'America/Los_Angeles'
    when 'WA' then 'America/Los_Angeles'
    when 'AK' then 'America/Anchorage'
    when 'HI' then 'Pacific/Honolulu'
    when 'AZ' then 'America/Phoenix'
    when 'CO' then 'America/Denver'
    when 'MT' then 'America/Denver'
    when 'NM' then 'America/Denver'
    when 'UT' then 'America/Denver'
    when 'WY' then 'America/Denver'
    when 'ID' then 'America/Boise'
    when 'IL' then 'America/Chicago'
    when 'AL' then 'America/Chicago'
    when 'AR' then 'America/Chicago'
    when 'IA' then 'America/Chicago'
    when 'KS' then 'America/Chicago'
    when 'LA' then 'America/Chicago'
    when 'MN' then 'America/Chicago'
    when 'MS' then 'America/Chicago'
    when 'MO' then 'America/Chicago'
    when 'ND' then 'America/Chicago'
    when 'NE' then 'America/Chicago'
    when 'OK' then 'America/Chicago'
    when 'SD' then 'America/Chicago'
    when 'TN' then 'America/Chicago'
    when 'WI' then 'America/Chicago'
    when 'KY' then 'America/New_York'
    when 'IN' then 'America/Indiana/Indianapolis'
    when 'MI' then 'America/Detroit'
    else 'America/New_York'
  end
$function$;

alter table public.dispensaries add column if not exists timezone text;

update public.dispensaries
set timezone = public.us_state_timezone(state, longitude)
where timezone is null;

-- Keep it populated: fill on insert, and recompute when the state changes.
-- (longitude is a generated column not yet available in a BEFORE trigger, so
-- read the point directly.)
create or replace function public.set_dispensary_timezone()
returns trigger language plpgsql set search_path to 'public', 'extensions' as $function$
begin
  if new.timezone is null or (tg_op = 'UPDATE' and new.state is distinct from old.state) then
    new.timezone := public.us_state_timezone(
      new.state,
      case when new.location is not null then ST_X(new.location::geometry) else null end
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists dispensaries_set_timezone on public.dispensaries;
create trigger dispensaries_set_timezone
  before insert or update on public.dispensaries
  for each row execute function public.set_dispensary_timezone();

-- Evaluate hours in the shop's own timezone. Replaces the (jsonb, timestamptz)
-- signature; the new tz arg sits in the middle with a safe default.
drop function if exists public.is_dispensary_open(jsonb, timestamptz);
create or replace function public.is_dispensary_open(
  hours jsonb,
  tz text default 'America/Los_Angeles',
  at_ts timestamptz default now()
)
returns boolean language plpgsql stable set search_path to 'public' as $function$
declare
  local_ts  timestamp := at_ts at time zone coalesce(nullif(tz, ''), 'America/Los_Angeles');
  day_key   text := lower(to_char(local_ts, 'Dy'));
  now_hhmm  text := to_char(local_ts, 'HH24:MI');
  day_hours jsonb;
  open_t    text;
  close_t   text;
begin
  if hours is null then
    return false;
  end if;
  day_hours := hours -> day_key;
  if day_hours is null or jsonb_typeof(day_hours) = 'null' then
    return false;
  end if;
  open_t := day_hours ->> 'open';
  close_t := day_hours ->> 'close';
  if open_t is null or close_t is null then
    return false;
  end if;
  if close_t > open_t then
    return now_hhmm >= open_t and now_hhmm < close_t;
  else
    return now_hhmm >= open_t or now_hhmm < close_t;
  end if;
end;
$function$;

-- Recreate search_dispensaries so the "Open now" list filter evaluates hours in
-- each shop's own timezone (d.timezone) instead of the Pacific default. Only the
-- is_dispensary_open() call changed; the rest is verbatim.
create or replace function public.search_dispensaries(
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
  logo_url text, cover_image_url text, license_number text, is_medical boolean,
  is_recreational boolean, is_delivery boolean, is_pickup boolean, hours jsonb,
  latitude double precision, longitude double precision, status dispensary_status,
  featured boolean, rating_avg numeric, rating_count integer,
  created_at timestamp with time zone, updated_at timestamp with time zone,
  distance_meters double precision, is_open_now boolean, rank real, total_count bigint
)
language plpgsql stable set search_path to 'public', 'extensions' as $function$
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
  with matched as (
    select
      d.*,
      case when origin is null then null else ST_Distance(d.location, origin) end as distance_meters,
      public.is_dispensary_open(d.hours, d.timezone) as is_open_now,
      case when tsq is null then 0::real else ts_rank(d.search_vector, tsq) end as rank
    from public.dispensaries d
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
    o.distance_meters, o.is_open_now, o.rank,
    count(*) over () as total_count
  from open_filtered o
  order by
    o.featured desc,
    o.rank desc,
    o.distance_meters asc nulls last,
    o.name asc
  limit greatest(coalesce(result_limit, 20), 0)
  offset greatest(coalesce(result_offset, 0), 0);
end;
$function$;
