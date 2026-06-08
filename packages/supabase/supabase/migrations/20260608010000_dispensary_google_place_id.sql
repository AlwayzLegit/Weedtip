-- Store the Google Place ID for dispensaries enriched via the Google Places API.
-- Storing the place_id is permitted indefinitely under Google's terms; other
-- Places content (phone/website/hours) is cached and refreshed periodically.
set search_path = public, extensions;

alter table public.dispensaries
  add column if not exists google_place_id text;

comment on column public.dispensaries.google_place_id is
  'Google Places API place_id (stable reference for refreshing live details).';
