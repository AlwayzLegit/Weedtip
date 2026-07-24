-- Google ratings for listings we've already matched to a Google Place.
--
-- Deliberately SEPARATE from rating_avg / rating_count (Weedtip's own reviews):
-- mixing them into one column would erase where a number came from, and every
-- surface that shows a Google rating has to attribute it. Keeping both lets a
-- listing show "3 Weedtip reviews" and "4.6 on Google" truthfully, and lets
-- ranking prefer our own verified reviews when they exist.
--
-- CACHING / TERMS: Google Maps Platform allows only temporary caching of Places
-- content (place IDs excepted, which may be stored indefinitely). We stamp
-- google_rating_at on every fetch and treat anything older than
-- GOOGLE_RATING_TTL_DAYS (30) as STALE — stale ratings are neither displayed nor
-- ranked on, and the backfill re-fetches them. google_maps_uri is stored so
-- every displayed rating can link back to its source listing as attribution.
alter table public.dispensaries
  add column if not exists google_rating numeric(2,1),
  add column if not exists google_rating_count integer,
  add column if not exists google_rating_at timestamptz,
  add column if not exists google_maps_uri text;

comment on column public.dispensaries.google_rating is
  'Star rating from Google Places. Attribute to Google wherever shown; refresh within 30 days.';
comment on column public.dispensaries.google_rating_count is
  'Number of Google ratings behind google_rating.';
comment on column public.dispensaries.google_rating_at is
  'When the Google rating was fetched. Older than 30 days = stale: do not display or rank on it.';
comment on column public.dispensaries.google_maps_uri is
  'Google Maps listing URL — the attribution link shown alongside a Google rating.';

alter table public.dispensaries
  add constraint dispensaries_google_rating_range
  check (google_rating is null or (google_rating >= 1 and google_rating <= 5));

-- Backfill/refresh queue: rows with a place id whose rating is missing or stale.
create index if not exists dispensaries_google_rating_at_idx
  on public.dispensaries (google_rating_at nulls first)
  where google_place_id is not null;

-- Ranking + "top rated" surfaces read this a lot; index the fresh, rated rows.
create index if not exists dispensaries_google_rating_idx
  on public.dispensaries (google_rating desc nulls last)
  where google_rating is not null;
