-- Retire the placements-based hero: migrate active house heroes onto region
-- hero ad_subscriptions, then deactivate the source placements. Nationwide
-- placements map to the nationwide region; state-scoped placements map to the
-- first region in that state's market (get_region_hero matches any region in
-- the visitor's state, so exact metro doesn't matter). Each placement takes a
-- distinct open hero slot in its target region.

with picks as (
  select
    p.id as placement_id,
    p.dispensary_id,
    p.brand_id,
    p.creative_id,
    p.ends_at,
    coalesce(
      (
        select r.id
        from public.ad_regions r
        join public.ad_markets m on m.id = r.market_id
        where m.state = p.scope_state and r.slug <> 'nationwide'
        order by r.sort_order nulls last, r.name
        limit 1
      ),
      (select id from public.ad_regions where slug = 'nationwide')
    ) as region_id
  from public.placements p
  where p.type = 'hero' and p.is_active
),
numbered_picks as (
  select pk.*, row_number() over (partition by pk.region_id order by pk.placement_id) as pick_rank
  from picks pk
),
open_slots as (
  select
    s.region_id,
    s.id as slot_id,
    row_number() over (partition by s.region_id order by s.position) as slot_rank
  from public.ad_slots s
  where s.slot_type = 'hero'
    and not exists (
      select 1 from public.ad_subscriptions sub
      where sub.slot_id = s.id and sub.status in ('pending', 'active', 'past_due')
    )
)
insert into public.ad_subscriptions
  (slot_id, dispensary_id, brand_id, creative_id, price_paid, status, is_house, starts_at, ends_at)
select
  os.slot_id,
  np.dispensary_id,
  np.brand_id,
  np.creative_id,
  0,
  'active',
  true,
  now(),
  coalesce(np.ends_at, now() + interval '30 days')
from numbered_picks np
join open_slots os on os.region_id = np.region_id and os.slot_rank = np.pick_rank;

-- Region hero subs serve these now — retire the source placements.
update public.placements set is_active = false where type = 'hero' and is_active;
