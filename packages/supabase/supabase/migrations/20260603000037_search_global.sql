set search_path = public, extensions;

-- Unified site-wide search across the four discovery entities. Returns a small
-- set per kind with a common card shape. SECURITY INVOKER (default) so RLS
-- applies: anon sees only active dispensaries/products; brands/strains are public.
-- FTS where available (dispensaries/products search_vector), trigram similarity
-- for brands/strains (pg_trgm).
create or replace function public.search_global(
  search_query text,
  per_kind_limit integer default 6
) returns table (
  kind text,
  id uuid,
  slug text,
  name text,
  subtitle text,
  image_url text,
  rank real
) language sql stable as $$
  with q as (
    select websearch_to_tsquery('english', coalesce(search_query, '')) as tsq,
           coalesce(trim(search_query), '') as raw
  )
  (
    select 'dispensary'::text, d.id, d.slug, d.name,
           (d.city || ', ' || d.state)::text,
           coalesce(d.logo_url, d.cover_image_url),
           ts_rank(d.search_vector, q.tsq)::real
    from public.dispensaries d, q
    where d.status = 'active'
      and (q.tsq @@ d.search_vector or d.name ilike '%' || q.raw || '%')
    order by ts_rank(d.search_vector, q.tsq) desc, d.name
    limit per_kind_limit
  )
  union all
  (
    select 'product'::text, p.id, p.slug, p.name,
           nullif(p.brand, ''),
           (p.image_urls)[1],
           ts_rank(p.search_vector, q.tsq)::real
    from public.products p
    join public.dispensaries d on d.id = p.dispensary_id and d.status = 'active'
    cross join q
    where (q.tsq @@ p.search_vector or p.name ilike '%' || q.raw || '%')
    order by ts_rank(p.search_vector, q.tsq) desc, p.name
    limit per_kind_limit
  )
  union all
  (
    select 'brand'::text, b.id, b.slug, b.name, 'Brand'::text, b.logo_url,
           similarity(b.name, q.raw)::real
    from public.brands b, q
    where q.raw <> '' and b.name ilike '%' || q.raw || '%'
    order by similarity(b.name, q.raw) desc, b.name
    limit per_kind_limit
  )
  union all
  (
    select 'strain'::text, s.id, s.slug, s.name, initcap(s.type::text), s.image_url,
           similarity(s.name, q.raw)::real
    from public.strains s, q
    where q.raw <> '' and s.name ilike '%' || q.raw || '%'
    order by similarity(s.name, q.raw) desc, s.name
    limit per_kind_limit
  );
$$;
grant execute on function public.search_global(text, integer) to anon, authenticated;
