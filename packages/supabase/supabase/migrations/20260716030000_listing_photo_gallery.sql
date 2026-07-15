-- ════════════════════════════════════════════════════════════════════════════
-- 20260716030000_listing_photo_gallery
-- Listing-editor parity (roadmap ②), slice 3 — owner photo gallery. Ordered list
-- of owner-uploaded storefront photos (distinct from google_photo_names, which
-- are sourced from Google). First element is the lead photo.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

alter table public.dispensaries
  add column if not exists gallery_urls text[] not null default '{}';

alter table public.dispensaries drop constraint if exists dispensaries_gallery_max;
alter table public.dispensaries
  add constraint dispensaries_gallery_max check (cardinality(gallery_urls) <= 12);
