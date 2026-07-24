-- ════════════════════════════════════════════════════════════════════════════
-- 20260724120000_state_listing_counts
-- SEO internal-linking (Tier 2 / cause C): a cheap per-state active-listing
-- count that feeds the new /dispensaries/locations index and the sitewide
-- footer "browse by state" rail. These put every state directory hub ≤1 click
-- from any page, so the state → city → shop tree stops being reachable only via
-- the sitemap (Semrush "orphaned sitemap pages", "only one internal link").
--
-- SECURITY DEFINER + anon grant so the static/ISR render path can read it; it
-- exposes only aggregate counts over already-public active listings.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

create or replace function public.state_listing_counts()
returns table(state character, count bigint)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
  select d.state, count(*)::bigint as count
  from public.dispensaries d
  where d.status = 'active' and d.state is not null
  group by d.state
  order by count(*) desc, d.state;
$function$;

grant execute on function public.state_listing_counts() to anon, authenticated;
