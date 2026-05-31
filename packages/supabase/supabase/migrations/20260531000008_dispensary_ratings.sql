-- ════════════════════════════════════════════════════════════════════════════
-- 20260531000008_dispensary_ratings
-- Denormalize review aggregates onto dispensaries (rating_avg, rating_count),
-- kept in sync by a trigger on reviews. Makes ratings available to every read
-- (list cards, search RPC, mobile) without a per-row aggregate subquery.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

alter table public.dispensaries
  add column rating_avg numeric(2, 1) not null default 0,
  add column rating_count integer not null default 0;

-- Recompute aggregates for one dispensary. SECURITY DEFINER so a consumer inserting
-- a review (which they're allowed to do) can drive the dispensaries update that RLS
-- would otherwise forbid. Touches only rating_* (no status/featured), so the
-- admin-fields guard trigger permits it.
create or replace function public.recalc_dispensary_rating(target_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.dispensaries d
  set rating_avg = coalesce(
        (select round(avg(rating)::numeric, 1) from public.reviews where dispensary_id = target_id),
        0
      ),
      rating_count = (select count(*) from public.reviews where dispensary_id = target_id)
  where d.id = target_id;
$$;

create or replace function public.reviews_rating_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recalc_dispensary_rating(coalesce(new.dispensary_id, old.dispensary_id));
  return null;
end;
$$;

create trigger reviews_sync_rating
  after insert or update or delete on public.reviews
  for each row
  execute function public.reviews_rating_sync();

-- Backfill existing data.
update public.dispensaries d
set rating_avg = coalesce(
      (select round(avg(rating)::numeric, 1) from public.reviews where dispensary_id = d.id),
      0
    ),
    rating_count = (select count(*) from public.reviews where dispensary_id = d.id);

-- ─── Re-create search_dispensaries to surface ratings ────────────────────────
-- Return type changes, so drop + recreate (and re-grant).
drop function if exists public.search_dispensaries(
  text, double precision, double precision, double precision,
  boolean, boolean, boolean, boolean, boolean, text, integer, integer
);

create function public.search_dispensaries(
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
  rating_avg      numeric,
  rating_count    integer,
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
$$;

grant execute on function public.search_dispensaries(
  text, double precision, double precision, double precision,
  boolean, boolean, boolean, boolean, boolean, text, integer, integer
) to anon, authenticated;
