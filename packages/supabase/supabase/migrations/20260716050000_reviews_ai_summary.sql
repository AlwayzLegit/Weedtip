-- ════════════════════════════════════════════════════════════════════════════
-- 20260716050000_reviews_ai_summary
-- Listing-editor parity (roadmap ②), slice 5 — AI review summary. A cached
-- 2–3 sentence summary of a shop's reviews (generated on demand by the owner,
-- not per page view). reviews_summary_count records how many reviews it covered
-- so the UI can flag when it's stale.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

alter table public.dispensaries
  add column if not exists reviews_summary text,
  add column if not exists reviews_summary_at timestamptz,
  add column if not exists reviews_summary_count integer;
