-- Drop the unused active_placements view. It's a SECURITY DEFINER view (the
-- only ERROR-level finding in Supabase's security advisor) with no callers
-- anywhere in application code or in any other database function/view —
-- confirmed via a pg_depend dependency check before dropping. Left over from
-- early ad-system scaffolding; ad serving reads `placements` directly through
-- its own RLS-respecting queries (see lib/ad-serving.ts) instead.
drop view if exists public.active_placements;
