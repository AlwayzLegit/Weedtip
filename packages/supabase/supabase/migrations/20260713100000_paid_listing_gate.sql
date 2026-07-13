-- ════════════════════════════════════════════════════════════════════════════
-- 20260713100000_paid_listing_gate
--
-- 1) Fix: anon reads of public.placements have been erroring with "permission
--    denied for function owns_brand" since the placements_select policy grew an
--    owns_brand(brand_id) arm (20260602000035_brand_placements) — the policy
--    expression calls the function per-row, but anon was never granted EXECUTE.
--    Granting it is safe: it's a SECURITY DEFINER ownership check against
--    auth.uid(), which is null for anon, so it simply returns false.
--
-- 2) is_paid_listing(): a public boolean for "does this dispensary pay us?" —
--    an active subscription or any currently-live paid placement. Used to gate
--    free-listing-only UI (e.g. the competitor cross-promo rail on dispensary
--    pages). SECURITY DEFINER so it can consult dispensary_subscriptions
--    (owner/admin-read under RLS) while exposing only a boolean.
-- ════════════════════════════════════════════════════════════════════════════

grant execute on function public.owns_brand(uuid) to anon;

create or replace function public.is_paid_listing(p_dispensary_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.dispensary_subscriptions s
    where s.dispensary_id = p_dispensary_id
      and s.status = 'active'
      and (s.current_period_end is null or s.current_period_end >= now())
  )
  or exists (
    select 1 from public.placements p
    where p.dispensary_id = p_dispensary_id
      and p.is_active
      and p.starts_at <= now()
      and (p.ends_at is null or p.ends_at >= now())
  );
$$;

revoke all on function public.is_paid_listing(uuid) from public;
grant execute on function public.is_paid_listing(uuid) to anon, authenticated;
