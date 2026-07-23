-- Unify the homepage hero onto the region ad-slot system (serving slice).
-- Hero slots are sold through ad_subscriptions like every other merchandised
-- spot; this RPC returns a region's active hero fills in the same shape as the
-- legacy get_hero_placements, so lib/hero can serve region fills first and fall
-- back to the placements-based hero during the transition.
--
-- A visitor resolves to a state (+ optional city) via the location modal. Hero
-- slots live in metro regions (via ad_slots → ad_regions → ad_markets); a slot
-- serves the visitor when its market's state matches (specificity 2) or when it
-- is the nationwide fallback region (specificity 1). SECURITY DEFINER so anon
-- visitors can read the owner-restricted ad_subscriptions, matching
-- get_region_placements.

create or replace function public.get_region_hero(
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
security definer
set search_path = public
as $$
  select
    sub.id,
    case when sub.brand_id is not null then 'brand' else 'dispensary' end,
    coalesce(b.slug, d.slug),
    coalesce(b.name, d.name),
    d.city,
    d.state,
    coalesce(c.image_url, d.cover_image_url),
    coalesce(b.logo_url, d.logo_url),
    c.headline,
    coalesce(b.rating_avg, d.rating_avg),
    coalesce(b.rating_count, d.rating_count),
    case when m.state = p_state then 2 else 1 end
  from public.ad_subscriptions sub
  join public.ad_slots s on s.id = sub.slot_id and s.slot_type = 'hero'
  join public.ad_regions r on r.id = s.region_id
  join public.ad_markets m on m.id = r.market_id
  left join public.dispensaries d on d.id = sub.dispensary_id and d.status = 'active'
  left join public.brands b on b.id = sub.brand_id
  left join public.ad_creatives c on c.id = sub.creative_id
  where sub.status = 'active'
    and (sub.dispensary_id is null or d.id is not null)
    and coalesce(b.slug, d.slug) is not null
    and (m.slug = 'nationwide' or (p_state is not null and m.state = p_state))
  order by
    case when m.state = p_state then 2 else 1 end desc,
    s.position
  limit 8;
$$;

grant execute on function public.get_region_hero(text, text) to anon, authenticated;
