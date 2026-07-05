-- ════════════════════════════════════════════════════════════════════════════
-- 20260705040000_region_directory
-- Redesign Phase 2 (homepage as merchandised feed): one cheap call powering the
-- Weedmaps-style region/city link grid — every active state with its listing
-- count and top cities, so the ISR homepage doesn't page through 9k rows.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

create or replace function public.region_directory(top_cities_limit integer default 6)
returns table (state char(2), dispensary_count bigint, top_cities jsonb)
language sql stable set search_path = public
as $function$
  with shops as (
    select d.state, d.city
    from public.dispensaries d
    where d.status = 'active'
  ),
  by_city as (
    select s.state as st, s.city, count(*) as n
    from shops s
    where s.city is not null and btrim(s.city) <> ''
    group by s.state, s.city
  ),
  ranked as (
    select st, city, n,
           row_number() over (partition by st order by n desc, city asc) as rn
    from by_city
  ),
  top as (
    select st,
           jsonb_agg(jsonb_build_object('city', city, 'count', n) order by n desc, city asc)
             as cities
    from ranked
    where rn <= greatest(coalesce(top_cities_limit, 6), 1)
    group by st
  ),
  counts as (
    select s.state as st, count(*) as c
    from shops s
    group by s.state
  )
  select c.st, c.c, coalesce(t.cities, '[]'::jsonb)
  from counts c
  left join top t on t.st = c.st
  order by c.c desc, c.st asc;
$function$;

grant execute on function public.region_directory(integer) to anon, authenticated;
