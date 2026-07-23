-- Unify brand + product merchandising onto the ad-regions system (slice 1a).
-- Featured brands and featured products become region ad-slot types sold through
-- ad_subscriptions, so every merchandised spot — hero, dispensary, brand,
-- product — is managed in one place (the ad desk) and scoped to the same metro
-- regions. Enum values must commit before use, so they live in their own
-- migration ahead of the inventory that references them.
alter type public.ad_slot_type add value if not exists 'brand';
alter type public.ad_slot_type add value if not exists 'product';
