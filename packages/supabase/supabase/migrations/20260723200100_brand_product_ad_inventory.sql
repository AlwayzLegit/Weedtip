-- Unify brand + product merchandising onto the ad-regions system (slice 1b):
-- target column, region inventory, and serving RPCs. Non-breaking — nothing
-- serves from this yet; the placements/auction-based featured strips keep
-- running until the serving slice swaps them.

-- A product slot merchandises a specific PRODUCT (the target), independent of
-- who pays for it (the advertiser — a dispensary that carries it, or its brand,
-- via the existing dispensary_id XOR brand_id advertiser model). Brand slots
-- need no target column: the advertiser brand IS what's shown.
alter table public.ad_subscriptions
  add column if not exists product_id uuid references public.products(id) on delete cascade;

create index if not exists ad_subscriptions_product_idx
  on public.ad_subscriptions (product_id) where product_id is not null;

-- Region inventory. Featured brands: 6 slots per real region, 8 nationwide.
-- Featured products: 8 per real region, 12 nationwide (denser grid, like a
-- Weedmaps sponsored product rail).
insert into public.ad_slots (region_id, slot_type, position)
  select r.id, 'brand'::public.ad_slot_type, gs.position
  from public.ad_regions r
  cross join lateral generate_series(1, case when r.slug = 'nationwide' then 8 else 6 end) as gs(position)
  where not exists (
    select 1 from public.ad_slots s
    where s.region_id = r.id and s.slot_type = 'brand' and s.position = gs.position
  );

insert into public.ad_slots (region_id, slot_type, position)
  select r.id, 'product'::public.ad_slot_type, gs.position
  from public.ad_regions r
  cross join lateral generate_series(1, case when r.slug = 'nationwide' then 12 else 8 end) as gs(position)
  where not exists (
    select 1 from public.ad_slots s
    where s.region_id = r.id and s.slot_type = 'product' and s.position = gs.position
  );

-- ─── Serving ────────────────────────────────────────────────────────────────
-- Active featured-brand fills for a region, in slot order. Advertiser is always
-- the brand for brand slots.
create or replace function public.get_region_featured_brands(p_region_id uuid)
returns table (
  brand_id   uuid,
  "position" integer,
  is_house   boolean,
  creative_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select sub.brand_id, s.position, sub.is_house, sub.creative_id
  from public.ad_slots s
  join public.ad_subscriptions sub on sub.slot_id = s.id and sub.status = 'active'
  where s.region_id = p_region_id
    and s.slot_type = 'brand'
    and sub.brand_id is not null
  order by s.position;
$$;
grant execute on function public.get_region_featured_brands(uuid) to anon, authenticated;

-- Active featured-product fills for a region, in slot order. Returns the target
-- product plus the paying advertiser (dispensary or brand) for attribution.
create or replace function public.get_region_featured_products(p_region_id uuid)
returns table (
  product_id             uuid,
  "position"             integer,
  is_house               boolean,
  advertiser_dispensary_id uuid,
  advertiser_brand_id    uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select sub.product_id, s.position, sub.is_house, sub.dispensary_id, sub.brand_id
  from public.ad_slots s
  join public.ad_subscriptions sub on sub.slot_id = s.id and sub.status = 'active'
  where s.region_id = p_region_id
    and s.slot_type = 'product'
    and sub.product_id is not null
  order by s.position;
$$;
grant execute on function public.get_region_featured_products(uuid) to anon, authenticated;
