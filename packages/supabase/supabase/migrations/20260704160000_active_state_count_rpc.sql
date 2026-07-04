-- The homepage "States" stat previously derived its count by fetching every
-- active dispensary's `state` column client-side and de-duping in JS
-- (apps/web/app/page.tsx). With 9,000+ active rows and no explicit row limit
-- on that query, PostgREST's default max-rows cap silently truncated the
-- result set before the dedupe ever ran, undercounting real state coverage.
-- A server-side count(distinct state) avoids fetching raw rows entirely.
create or replace function public.get_active_dispensary_state_count()
returns integer
language sql
stable
as $$
  select count(distinct state)::integer
  from public.dispensaries
  where status = 'active';
$$;

grant execute on function public.get_active_dispensary_state_count() to anon, authenticated;
