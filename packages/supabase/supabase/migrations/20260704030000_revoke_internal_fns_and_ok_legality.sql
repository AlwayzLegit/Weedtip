-- ════════════════════════════════════════════════════════════════════════════
-- 20260704030000_revoke_internal_fns_and_ok_legality
-- Audit follow-ups (applied to prod alongside the orders write guard):
--   • SECURITY: recalc_dispensary_rating / recalc_product_rating are internal
--     recompute helpers (called by rating triggers), and sync_featured_flags is
--     called by the featured-sync path — none are meant for direct client calls.
--     anon/authenticated EXECUTE let anyone trigger unbounded write-amplification
--     (advisor-flagged). Revoke it; trigger/DEFINER callers are unaffected.
--   • DATA/COMPLIANCE: 2 Oklahoma listings were flagged recreational, but OK is a
--     medical-only market. Clear the flag to match operating_regions.
-- (NV delivery flags are intentionally NOT touched here — they're part of the
--  MT/NV column-mapping gap being fixed by a clean re-import.)
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

revoke execute on function public.recalc_dispensary_rating(uuid) from public, anon, authenticated;
revoke execute on function public.recalc_product_rating(uuid) from public, anon, authenticated;
revoke execute on function public.sync_featured_flags(uuid) from public, anon, authenticated;

update public.dispensaries d
set is_recreational = false
where d.state = 'OK' and d.is_recreational = true
  and not (select is_recreational_legal from public.operating_regions o where o.state = 'OK');
