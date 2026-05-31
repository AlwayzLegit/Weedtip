-- ════════════════════════════════════════════════════════════════════════════
-- 20260530000005_search
-- Search layer: Postgres FTS + PostGIS geo ranking, exposed as RPCs. This is the
-- stable contract the frontend calls (matches @weedtip/shared search schemas).
-- Swapping in Typesense/Meilisearch later means replacing these function bodies
-- (or the Edge Function caller) while keeping the same input/output shape.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

-- ─── is_dispensary_open ──────────────────────────────────────────────────────
-- Evaluate an `hours` JSONB blob against a moment. Handles overnight windows
-- (close < open). NOTE: evaluated in the timestamp's own offset; per-location
-- timezone handling is a Phase-2 refinement (we don't yet store a tz per shop).
create or replace function public.is_dispensary_open(hours jsonb, at_ts timestamptz default now())
returns boolean
language plpgsql
stable
as $$
declare
  day_key   text := lower(to_char(at_ts, 'Dy')); -- mon, tue, …, sun
  now_hhmm  text := to_char(at_ts, 'HH24:MI');
  day_hours jsonb;
  open_t    text;
  close_t   text;
begin
  if hours is null then
    return false;
  end if;

  day_hours := hours -> day_key;
  if day_hours is null or jsonb_typeof(day_hours) = 'null' then
    return false; -- closed that day
  end if;

  open_t := day_hours ->> 'open';
  close_t := day_hours ->> 'close';
  if open_t is null or close_t is null then
    return false;
  end if;

  if close_t > open_t then
    return now_hhmm >= open_t and now_hhmm < close_t;
  else
    -- Overnight window, e.g. open 18:00 close 02:00.
    return now_hhmm >= open_t or now_hhmm < close_t;
  end if;
end;
$$;

-- ─── search_dispensaries ─────────────────────────────────────────────────────
-- Ranked, geo-aware dispensary search. `total_count` is the same on every row
-- (window count) so clients can paginate without a second query.
create or replace function public.search_dispensaries(
  search_query          text default null,
  lat                   double precision default null,
  lng                   double precision default null,
  radius_meters         double precision default 40000,
  filter_delivery       boolean default null,
  filter_pickup         boolean default null,
  filter_medical        boolean default null,
  filter_recreational   boolean default null,
  filter_open_now       boolean default false,
  filter_category_slug  text default null,
  result_limit          integer default 20,
  result_offset         integer default 0
)
returns table (
  id              uuid,
  owner_id        uuid,
  name            text,
  slug            text,
  description     text,
  address         text,
  city            text,
  state           char(2),
  zip             text,
  phone           text,
  email           text,
  website         text,
  logo_url        text,
  cover_image_url text,
  license_number  text,
  is_medical      boolean,
  is_recreational boolean,
  is_delivery     boolean,
  is_pickup       boolean,
  hours           jsonb,
  latitude        double precision,
  longitude       double precision,
  status          public.dispensary_status,
  featured        boolean,
  created_at      timestamptz,
  updated_at      timestamptz,
  distance_meters double precision,
  is_open_now     boolean,
  rank            real,
  total_count     bigint
)
language plpgsql
stable
set search_path = public, extensions
as $$
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
      public.is_dispensary_open(d.hours) as is_open_now,
      case when tsq is null then 0::real else ts_rank(d.search_vector, tsq) end as rank
    from public.dispensaries d
    where d.status = 'active'
      and (tsq is null or d.search_vector @@ tsq)
      and (origin is null or ST_DWithin(d.location, origin, radius_meters))
      and (filter_delivery is null or d.is_delivery = filter_delivery)
      and (filter_pickup is null or d.is_pickup = filter_pickup)
      and (filter_medical is null or d.is_medical = filter_medical)
      and (filter_recreational is null or d.is_recreational = filter_recreational)
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
    o.status, o.featured, o.created_at, o.updated_at,
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
$$;

-- ─── search_products ─────────────────────────────────────────────────────────
-- Cross-dispensary product browse/search with category, strain, and price filters.
-- Only returns products from active dispensaries (public storefront semantics).
create or replace function public.search_products(
  search_query     text default null,
  filter_category_slug text default null,
  filter_strain    public.strain_type default null,
  filter_dispensary_id uuid default null,
  min_price_cents  integer default null,
  max_price_cents  integer default null,
  in_stock_only    boolean default true,
  result_limit     integer default 20,
  result_offset    integer default 0
)
returns table (
  id             uuid,
  dispensary_id  uuid,
  category_id    uuid,
  name           text,
  slug           text,
  brand          text,
  description    text,
  image_urls     text[],
  strain_type    public.strain_type,
  thc_percentage numeric,
  cbd_percentage numeric,
  price_cents    integer,
  weight_grams   numeric,
  unit           text,
  in_stock       boolean,
  is_featured    boolean,
  created_at     timestamptz,
  updated_at     timestamptz,
  rank           real,
  total_count    bigint
)
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  tsq tsquery := case
    when search_query is null or btrim(search_query) = ''
    then null
    else websearch_to_tsquery('english', search_query)
  end;
begin
  return query
  with matched as (
    select
      p.*,
      case when tsq is null then 0::real else ts_rank(p.search_vector, tsq) end as rank
    from public.products p
    join public.dispensaries d on d.id = p.dispensary_id and d.status = 'active'
    left join public.categories c on c.id = p.category_id
    where (tsq is null or p.search_vector @@ tsq)
      and (filter_category_slug is null or c.slug = filter_category_slug)
      and (filter_strain is null or p.strain_type = filter_strain)
      and (filter_dispensary_id is null or p.dispensary_id = filter_dispensary_id)
      and (min_price_cents is null or p.price_cents >= min_price_cents)
      and (max_price_cents is null or p.price_cents <= max_price_cents)
      and (in_stock_only is not true or p.in_stock)
  )
  select
    m.id, m.dispensary_id, m.category_id, m.name, m.slug, m.brand, m.description,
    m.image_urls, m.strain_type, m.thc_percentage, m.cbd_percentage, m.price_cents,
    m.weight_grams, m.unit, m.in_stock, m.is_featured, m.created_at, m.updated_at,
    m.rank,
    count(*) over () as total_count
  from matched m
  order by m.is_featured desc, m.rank desc, m.price_cents asc, m.name asc
  limit greatest(coalesce(result_limit, 20), 0)
  offset greatest(coalesce(result_offset, 0), 0);
end;
$$;
