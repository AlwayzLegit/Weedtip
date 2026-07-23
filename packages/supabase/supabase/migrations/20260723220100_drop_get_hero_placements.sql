-- Retire the legacy placements-based hero serving function. The homepage hero
-- serves entirely from get_region_hero now; nothing calls this anymore.
drop function if exists public.get_hero_placements(text, text);
