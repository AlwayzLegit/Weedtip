-- Fold the brand state-auction into the region brand-slot system: migrate any
-- live bid onto a brand region slot in its state, then cancel the bid. The
-- auction (advertiser side already mothballed) is retired; featured brands serve
-- entirely from region brand slots now. Idempotent — with no active bids the
-- CTE inserts nothing and the update touches no rows.

with bid as (
  select b.id as bid_id, b.brand_id, r.state, b.contract_end
  from public.brand_ad_bids b
  join public.brand_ad_regions r on r.id = b.region_id
  where b.status = 'active'
),
target as (
  select
    bid.*,
    coalesce(
      (
        select ar.id from public.ad_regions ar
        join public.ad_markets m on m.id = ar.market_id
        where m.state = bid.state and ar.slug <> 'nationwide'
        order by ar.sort_order nulls last, ar.name
        limit 1
      ),
      (select id from public.ad_regions where slug = 'nationwide')
    ) as region_id
  from bid
),
slotted as (
  select
    t.*,
    (
      select s.id from public.ad_slots s
      where s.region_id = t.region_id and s.slot_type = 'brand'
        and not exists (
          select 1 from public.ad_subscriptions sub
          where sub.slot_id = s.id and sub.status in ('pending', 'active', 'past_due')
        )
      order by s.position
      limit 1
    ) as slot_id
  from target t
)
insert into public.ad_subscriptions
  (slot_id, brand_id, price_paid, status, is_house, starts_at, ends_at)
select slot_id, brand_id, 0, 'active', true, now(), coalesce(contract_end, now() + interval '30 days')
from slotted
where slot_id is not null;

update public.brand_ad_bids set status = 'cancelled' where status = 'active';
