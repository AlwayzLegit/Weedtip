-- Marker for the admin "Enrich from Google" console: stamped on every attempt
-- (matched or not) so unmatched listings aren't re-queried — and re-billed —
-- on every batch. Clear it to make a listing eligible for another pass.
alter table public.dispensaries
  add column if not exists google_enriched_at timestamptz;
