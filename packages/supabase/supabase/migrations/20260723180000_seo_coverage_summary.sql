-- Admin SEO console aggregation: GSC coverage_state → count, in one round-trip
-- instead of paging the whole page_index_status table (grows to ~9k rows).
-- SECURITY INVOKER so the table's admin-only RLS still applies to the caller.
create or replace function public.seo_coverage_summary()
returns table (coverage_state text, n bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(coverage_state, 'Unknown') as coverage_state, count(*)::bigint as n
  from public.page_index_status
  group by 1
  order by 2 desc
$$;

comment on function public.seo_coverage_summary() is
  'Admin SEO console: GSC coverage_state → count. SECURITY INVOKER, so page_index_status RLS (admin-only) applies.';
