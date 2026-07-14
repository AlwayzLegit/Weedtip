-- ════════════════════════════════════════════════════════════════════════════
-- 20260714091000_lock_ad_metrics
--
-- Audit finding (medium): record_ad_event / record_placement_event are the
-- first-party metrics that PRICE the region ad system and prove advertiser
-- ROI, yet both are SECURITY DEFINER and granted to anon + authenticated —
-- so anyone could call them directly via PostgREST to inflate impressions/
-- clicks and poison the pricing recommendations. The beacon routes now write
-- through the service-role client behind a rate limit, so revoke the public
-- grants; only service_role (the routes) may record events.
-- ════════════════════════════════════════════════════════════════════════════

revoke execute on function public.record_ad_event(uuid, text, uuid, uuid, public.ad_slot_type)
  from public, anon, authenticated;
revoke execute on function public.record_placement_event(uuid, text)
  from public, anon, authenticated;
