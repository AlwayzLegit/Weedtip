-- ════════════════════════════════════════════════════════════════════════════
-- 20260531000015_search_products_ratings
-- Surface product rating_avg/rating_count from search_products (added to products
-- in 0013) so the products list can show ratings and sort by them. Drop + recreate
-- (return type change) and re-grant.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

drop function if exists public.search_products(
  text, text, public.strain_type, uuid, integer, integer, boolean, integer, integer
);

create function public.search_products(
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
  rating_avg     numeric,
  rating_count   integer,
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
    m.weight_grams, m.unit, m.in_stock, m.is_featured, m.rating_avg, m.rating_count,
    m.created_at, m.updated_at,
    m.rank,
    count(*) over () as total_count
  from matched m
  order by m.is_featured desc, m.rank desc, m.price_cents asc, m.name asc
  limit greatest(coalesce(result_limit, 20), 0)
  offset greatest(coalesce(result_offset, 0), 0);
end;
$$;

grant execute on function public.search_products(
  text, text, public.strain_type, uuid, integer, integer, boolean, integer, integer
) to anon, authenticated;
