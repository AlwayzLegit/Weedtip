-- Security hardening — addresses Supabase database advisors (all WARN level).
-- Idempotent: ALTER/REVOKE are safe to re-run.

-- 1) function_search_path_mutable
-- These three functions had no search_path pinned, so it resolved per-role.
-- Pin it. search_global uses similarity() from pg_trgm (extensions schema),
-- so it also needs `extensions`; the other two only touch public/built-ins.
alter function public.set_updated_at() set search_path = public;
alter function public.is_dispensary_open(jsonb, timestamptz) set search_path = public;
alter function public.search_global(text, integer) set search_path = public, extensions;

-- 2) anon/authenticated_security_definer_function_executable
-- These are SECURITY DEFINER *trigger* functions. They only ever run as table
-- triggers (in the context of the firing statement), never as RPCs, so no role
-- needs direct EXECUTE. Revoking removes them from the API surface without
-- affecting trigger behavior. RPC definer functions (place_*_bid, is_admin,
-- owns_dispensary, …) are intentionally left executable.
revoke execute on function public.enforce_dispensary_admin_fields() from public, anon, authenticated;
revoke execute on function public.enforce_profile_role()            from public, anon, authenticated;
revoke execute on function public.handle_new_user()                 from public, anon, authenticated;
revoke execute on function public.notify_order_event()              from public, anon, authenticated;
revoke execute on function public.product_reviews_rating_sync()     from public, anon, authenticated;
revoke execute on function public.reviews_rating_sync()             from public, anon, authenticated;
revoke execute on function public.reviews_set_verified()            from public, anon, authenticated;
revoke execute on function public.strain_favorites_count_sync()     from public, anon, authenticated;

-- 3) auth_leaked_password_protection (HaveIBeenPwned check) is an Auth config
-- toggle, not SQL — enable it in Dashboard → Authentication → Policies, or via
-- the Management API. Left as a deploy note.
