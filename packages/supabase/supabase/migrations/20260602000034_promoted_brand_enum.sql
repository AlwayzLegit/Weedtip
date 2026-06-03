-- New placement type for brand-level sponsored promotions. Must land in its own
-- migration/transaction so later statements may reference the new enum value.
alter type public.placement_type add value if not exists 'promoted_brand';
