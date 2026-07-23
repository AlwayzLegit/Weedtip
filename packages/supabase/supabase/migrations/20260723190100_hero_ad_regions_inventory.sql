-- Unify homepage hero merchandising onto the ad-regions system (slice 1b):
-- advertiser model + hero inventory. Non-breaking — nothing serves from this
-- yet; the placements-based hero keeps running until the serving slice swaps it.

-- Advertisers on ad_subscriptions can now be a dispensary OR a brand (brands buy
-- hero slots too), with an optional custom creative for the hero art. Exactly
-- one advertiser per row.
alter table public.ad_subscriptions
  add column if not exists brand_id uuid references public.brands(id) on delete cascade,
  add column if not exists creative_id uuid references public.ad_creatives(id) on delete set null;
alter table public.ad_subscriptions alter column dispensary_id drop not null;
alter table public.ad_subscriptions
  drop constraint if exists ad_subscriptions_one_advertiser;
alter table public.ad_subscriptions
  add constraint ad_subscriptions_one_advertiser
  check ((dispensary_id is not null) <> (brand_id is not null));

-- Nationwide fallback market + region. boundary is null so resolve_geo never
-- matches it; it's the explicit homepage default before a visitor's market is
-- known, and the fallback when their resolved region has no hero sold.
insert into public.ad_markets (slug, name, state)
  select 'nationwide', 'Nationwide', 'US'
  where not exists (select 1 from public.ad_markets where slug = 'nationwide');
insert into public.ad_regions
  (market_id, slug, name, tier, boundary, exclusive_price_min, exclusive_price_max, is_active, sort_order)
  select m.id, 'nationwide', 'Nationwide', 'B', null, 0, 0, true, -1
  from public.ad_markets m
  where m.slug = 'nationwide'
    and not exists (select 1 from public.ad_regions where slug = 'nationwide');

-- Hero carousel inventory: 6 hero slots per real region, 8 for nationwide.
insert into public.ad_slots (region_id, slot_type, position)
  select r.id, 'hero'::public.ad_slot_type, gs.position
  from public.ad_regions r
  cross join lateral generate_series(1, case when r.slug = 'nationwide' then 8 else 6 end) as gs(position)
  where not exists (
    select 1 from public.ad_slots s
    where s.region_id = r.id and s.slot_type = 'hero' and s.position = gs.position
  );
