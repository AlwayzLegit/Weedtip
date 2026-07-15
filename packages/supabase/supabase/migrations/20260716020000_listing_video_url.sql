-- ════════════════════════════════════════════════════════════════════════════
-- 20260716020000_listing_video_url
-- Listing-editor parity (roadmap ②), slice 2 — video-by-URL. Owners paste a
-- YouTube/Vimeo link; the storefront embeds it. Stored as-is; the app parses it
-- into a safe embed URL (only YouTube/Vimeo are ever framed).
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

alter table public.dispensaries add column if not exists video_url text;
