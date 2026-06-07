-- ════════════════════════════════════════════════════════════════════════════
-- 20260607200000_dispensary_delivery_only
-- Support location-less listings for delivery-only (non-storefront) retailers.
-- The DCC suppresses the premise address & coordinates for delivery-only
-- licenses (only the service-area county is public), so these listings can't
-- carry a mapped point. Relax the premise NOT NULLs and add a `county` column so
-- they can be listed (as "delivery only · serves <county> county"). Storefronts
-- are unaffected — they still have full address + location.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

alter table public.dispensaries
  alter column location drop not null,
  alter column address  drop not null,
  alter column city     drop not null,
  alter column zip      drop not null;

-- `zip` keeps its format CHECK; a NULL zip passes (CHECK is not violated by NULL).

alter table public.dispensaries
  add column if not exists county text;

comment on column public.dispensaries.county is
  'Service-area county for listings without a mapped premise (e.g. delivery-only).';
comment on column public.dispensaries.location is
  'WGS84 point, or NULL for delivery-only listings whose premise the DCC suppresses.';
