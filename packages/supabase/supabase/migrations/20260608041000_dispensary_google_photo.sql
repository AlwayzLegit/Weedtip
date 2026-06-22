-- Cache the Google Places photo reference for serving storefront cover images.
-- The photo name is treated as a cache (refreshed when re-enriched); the image
-- itself is fetched live via the Places Photo API (see /api/dispensary-cover).
set search_path = public, extensions;

alter table public.dispensaries
  add column if not exists google_photo_name text;

comment on column public.dispensaries.google_photo_name is
  'Google Places photo resource name (cached reference; image served live via the Photo API).';
