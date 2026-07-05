-- 20260705085900_retire_ad_bidding
-- Retire the dispensary regional ad AUCTION prototype (ad_regions + ad_bids,
-- state/city territories, highest-bid-wins). It never went live — both tables
-- are empty in production — and it is superseded by the two-layer geographic
-- ad system (ad_markets → ad_regions → ad_zones with fixed scarce slot
-- inventory) introduced in the following migrations, which reuse the
-- ad_regions name for the new model.
--
-- The BRAND ad auction (brand_ad_regions / brand_ad_bids) is a separate,
-- unrelated system and is untouched.

drop function if exists public.region_featured_dispensaries(char, text);
drop function if exists public.place_ad_bid(uuid, uuid, integer);
drop function if exists public.cancel_ad_bid(uuid);
drop function if exists public.ad_bids_for_owner(uuid);
drop function if exists public.activate_ad_bid(uuid, text);

drop table if exists public.ad_bids;
drop table if exists public.ad_regions;
