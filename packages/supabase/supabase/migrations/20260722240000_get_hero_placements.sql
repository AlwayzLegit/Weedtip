-- ════════════════════════════════════════════════════════════════════════════
-- 20260722240000_get_hero_placements
--
-- Region-scoped homepage hero carousel. The homepage is statically cached, so it
-- SSRs the nationwide hero and a client component swaps in the visitor's regional
-- slides. Consumers resolve to a state (+ optional city) via the location modal;
-- hero placements carry scope_state/scope_city (null = nationwide). This RPC
-- returns the most specific matching hero slides — city match > state match >
-- nationwide — for dispensaries AND brands, using the ad creative's art/headline
-- when present.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.get_hero_placements(
  p_state text default null,
  p_city text default null
)
returns table (
  placement_id uuid,
  kind text,
  slug text,
  name text,
  city text,
  state text,
  cover_url text,
  logo_url text,
  headline text,
  rating numeric,
  review_count integer,
  specificity integer
)
language sql
stable
set search_path = public
as $$
  select
    p.id,
    case when p.brand_id is not null then 'brand' else 'dispensary' end,
    coalesce(b.slug, d.slug),
    coalesce(b.name, d.name),
    d.city,
    d.state,
    coalesce(c.image_url, d.cover_image_url),
    coalesce(b.logo_url, d.logo_url),
    c.headline,
    coalesce(b.rating_avg, d.rating_avg),
    coalesce(b.rating_count, d.rating_count),
    case
      when p.scope_city is not null and p_city is not null
           and lower(p.scope_city) = lower(p_city) and p.scope_state = p_state then 3
      when p.scope_state is not null and p.scope_state = p_state and p.scope_city is null then 2
      when p.scope_state is null then 1
      else 0
    end
  from public.placements p
  left join public.dispensaries d on d.id = p.dispensary_id and d.status = 'active'
  left join public.brands b on b.id = p.brand_id
  left join public.ad_creatives c on c.id = p.creative_id
  where p.type = 'hero'
    and p.is_active
    and (p.starts_at is null or p.starts_at <= now())
    and (p.ends_at is null or p.ends_at >= now())
    and (p.dispensary_id is null or d.id is not null)
    and coalesce(b.slug, d.slug) is not null
    and (
      p.scope_state is null
      or (p.scope_state = p_state
          and (p.scope_city is null or p_city is null or lower(p.scope_city) = lower(p_city)))
    )
  order by
    case
      when p.scope_city is not null and p_city is not null
           and lower(p.scope_city) = lower(p_city) and p.scope_state = p_state then 3
      when p.scope_state is not null and p.scope_state = p_state and p.scope_city is null then 2
      when p.scope_state is null then 1
      else 0
    end desc,
    p.priority desc
  limit 8;
$$;

grant execute on function public.get_hero_placements(text, text) to anon, authenticated;
