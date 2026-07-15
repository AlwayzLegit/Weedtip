-- ════════════════════════════════════════════════════════════════════════════
-- 20260716040000_listing_special_hours
-- Listing-editor parity (roadmap ②), slice 4 — special / holiday hours. A JSONB
-- array of date-specific overrides on top of the weekly `hours`:
--   [{ "date": "YYYY-MM-DD", "closed": bool, "open": "HH:mm"?, "close": "HH:mm"?, "note": text? }]
-- Applied by the storefront for the open-now badge + an upcoming-hours panel.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

alter table public.dispensaries
  add column if not exists special_hours jsonb not null default '[]'::jsonb;

alter table public.dispensaries drop constraint if exists dispensaries_special_hours_shape;
alter table public.dispensaries
  add constraint dispensaries_special_hours_shape
  check (jsonb_typeof(special_hours) = 'array' and jsonb_array_length(special_hours) <= 60);
