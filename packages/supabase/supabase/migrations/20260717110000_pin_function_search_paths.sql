-- ════════════════════════════════════════════════════════════════════════════
-- 20260717110000_pin_function_search_paths
--
-- Security advisor: function_search_path_mutable. Pin search_path on the
-- three remaining functions so a role-level search_path can't redirect their
-- table references.
-- ════════════════════════════════════════════════════════════════════════════

alter function public.get_active_dispensary_state_count() set search_path = 'public';
alter function public.ad_region_zone_names() set search_path = 'public';
alter function public.us_state_timezone(p_state text, p_lng double precision) set search_path = 'public';
