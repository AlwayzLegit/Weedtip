-- ════════════════════════════════════════════════════════════════════════════
-- 20260719230000_harden_trigger_functions
-- Security-advisor hardening: trigger functions are invoked by their triggers
-- (rights come from the table owner), so nothing legitimate ever calls them
-- directly — revoke direct EXECUTE from client roles. Several are SECURITY
-- DEFINER, where a direct call would run privileged logic outside its trigger
-- context. (deal_alert_signups' with-check(true) INSERT was also flagged but
-- is intentional: a public email-capture form with admin-only reads.)
-- ════════════════════════════════════════════════════════════════════════════
revoke execute on function public.brand_reviews_rating_sync() from public, anon, authenticated;
revoke execute on function public.bump_review_helpful() from public, anon, authenticated;
revoke execute on function public.log_dispensary_changes() from public, anon, authenticated;
revoke execute on function public.notify_admins_new_claim() from public, anon, authenticated;
revoke execute on function public.orders_write_guard() from public, anon, authenticated;
revoke execute on function public.set_dispensary_timezone() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.stamp_claim_invite_claimed() from public, anon, authenticated;
