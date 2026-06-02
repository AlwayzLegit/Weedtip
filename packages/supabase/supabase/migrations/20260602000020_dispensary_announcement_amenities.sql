-- ════════════════════════════════════════════════════════════════════════════
-- 20260602000020_dispensary_announcement_amenities
-- Adds Weedmaps-style listing richness: a short announcement banner the owner can
-- pin to their storefront, and a set of amenity tags (ATM, parking, discounts…).
-- Both are owner-editable through the existing dispensary RLS update policy.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

alter table public.dispensaries add column announcement text;
alter table public.dispensaries
  add column amenities text[] not null default '{}'::text[];
