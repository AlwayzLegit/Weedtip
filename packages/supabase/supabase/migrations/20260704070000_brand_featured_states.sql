-- ════════════════════════════════════════════════════════════════════════════
-- 20260704070000_brand_featured_states
-- Audit finding #16: brands can buy per-state "Featured brand" bids in ~40 legal
-- states, but the /brands directory only made a state selectable if it had an
-- active product from that state (NY only today). So a paid placement in any
-- other state could never render — the market wasn't a selectable chip and the
-- state param was rejected before region_featured_brands() ever ran.
--
-- This helper returns exactly the states that currently have a winning brand bid
-- (same ranking region_featured_brands uses), so the directory can surface those
-- markets. anon-readable because /brands renders for logged-out visitors, and
-- brand_ad_bids itself is owner/admin-only under RLS.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create or replace function public.brand_featured_states()
returns table (state char(2))
language sql stable security definer set search_path = public as $$
  with ranked as (
    select r.state,
      rank() over (partition by b.region_id order by b.bid_cents desc, b.created_at) as rnk,
      r.slots
    from public.brand_ad_bids b
    join public.brand_ad_regions r on r.id = b.region_id
    where b.status = 'active' and r.is_active
  )
  select distinct state from ranked where rnk <= slots;
$$;

grant execute on function public.brand_featured_states() to anon, authenticated;
