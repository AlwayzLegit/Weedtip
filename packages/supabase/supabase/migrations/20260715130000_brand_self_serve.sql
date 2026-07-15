-- ════════════════════════════════════════════════════════════════════════════
-- 20260715130000_brand_self_serve
--
-- Lets brand owners create a brand from scratch (pending admin review), mirroring
-- the dispensary create-a-listing flow. Adds:
--   • brands.status — 'active' (default, all existing brands) | 'pending' (self-
--     created, awaiting review) | 'rejected'. The public SELECT policy is
--     tightened so non-active brands are visible ONLY to their owner and admins,
--     enforcing draft privacy at the database instead of in every query.
--   • a self-serve INSERT policy: a signed-in user may create a brand they own,
--     but only in 'pending' status (admins still insert active brands directly).
--   • brand_claims.business_email — a contact captured at claim time so we can
--     send acknowledgement + decision emails (parity with dispensary claims).
-- ════════════════════════════════════════════════════════════════════════════

alter table public.brands
  add column if not exists status text not null default 'active'
    check (status in ('pending', 'active', 'rejected'));

-- Hide pending/rejected brands from the public; owners and admins still see them.
drop policy if exists brands_select_public on public.brands;
create policy brands_select_public on public.brands
  for select to anon, authenticated
  using (status = 'active' or owner_id = auth.uid() or public.is_admin());

-- Self-serve creation: create a brand you own, pending review. (The existing
-- admin insert policy is untouched, so admins can still create active brands.)
drop policy if exists brands_insert_self on public.brands;
create policy brands_insert_self on public.brands
  for insert to authenticated
  with check (owner_id = auth.uid() and status = 'pending');

alter table public.brand_claims
  add column if not exists business_email text;
