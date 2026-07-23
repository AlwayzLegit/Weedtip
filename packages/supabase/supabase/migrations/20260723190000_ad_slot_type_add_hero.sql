-- Unify homepage hero merchandising onto the ad-regions system (slice 1a).
-- The hero becomes a region ad-slot type sold through ad_subscriptions, so every
-- top spot is managed in one place (the ad desk). Adding the enum value must
-- commit before it can be used, so it lives in its own migration.
alter type public.ad_slot_type add value if not exists 'hero';
