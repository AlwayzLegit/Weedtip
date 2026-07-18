-- ════════════════════════════════════════════════════════════════════════════
-- 20260719110000_member_capability_rls
--
-- DB backstop for the P4 team role matrix. Until now owns_dispensary() granted
-- ANY active member full write access to shop content, so an associate or
-- campaign_manager could bypass the app-layer nav/page/action gates by calling
-- the API directly. member_can(dispensary, capability) mirrors the app's
-- MEMBER_CAPS matrix (lib/member-roles.ts): the account owner has every
-- capability; active members get only their role's slice.
--
-- Reads stay on owns_dispensary() (any active member may view shop data — the
-- dashboard aggregates need it and reads aren't the threat). This tightens the
-- WRITE policies where a role boundary is meaningful: marketing (deals, promos,
-- updates), orders + register (orders, pos_shifts, pos_staff), and the listing
-- row itself (dispensaries). Menu writes (products, menu_sources) stay open
-- because every role has the 'menu' capability.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create or replace function public.member_can(target_dispensary_id uuid, cap text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1 from public.dispensaries
      where id = target_dispensary_id and owner_id = auth.uid()
    )
    or exists (
      select 1 from public.dispensary_members m
      where m.dispensary_id = target_dispensary_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and case cap
              when 'menu'      then true
              when 'listing'   then m.role = 'manager'
              when 'orders'    then m.role = 'manager'
              when 'reviews'   then m.role = 'manager'
              when 'analytics' then m.role in ('manager', 'campaign_manager')
              when 'marketing' then m.role = 'campaign_manager'
              else false  -- 'owner'-tier caps (billing/team/taxes): account owner only
            end
    );
$$;
grant execute on function public.member_can(uuid, text) to authenticated, anon;

-- ── Marketing writes: owner + campaign_manager ──────────────────────────────
alter policy deals_insert_owner_or_admin on public.deals
  with check (public.member_can(dispensary_id, 'marketing') or is_admin());
alter policy deals_update_owner_or_admin on public.deals
  using (public.member_can(dispensary_id, 'marketing') or is_admin())
  with check (public.member_can(dispensary_id, 'marketing') or is_admin());
alter policy deals_delete_owner_or_admin on public.deals
  using (public.member_can(dispensary_id, 'marketing') or is_admin());

alter policy dispensary_promos_write_insert on public.dispensary_promos
  with check (public.member_can(dispensary_id, 'marketing') or is_admin());
alter policy dispensary_promos_write_update on public.dispensary_promos
  using (public.member_can(dispensary_id, 'marketing') or is_admin())
  with check (public.member_can(dispensary_id, 'marketing') or is_admin());
alter policy dispensary_promos_write_delete on public.dispensary_promos
  using (public.member_can(dispensary_id, 'marketing') or is_admin());

alter policy dispensary_updates_write_insert on public.dispensary_updates
  with check (public.member_can(dispensary_id, 'marketing') or is_admin());
alter policy dispensary_updates_write_update on public.dispensary_updates
  using (public.member_can(dispensary_id, 'marketing') or is_admin())
  with check (public.member_can(dispensary_id, 'marketing') or is_admin());
alter policy dispensary_updates_write_delete on public.dispensary_updates
  using (public.member_can(dispensary_id, 'marketing') or is_admin());

-- ── Orders + register writes: owner + manager (keep the customer own-row branch) ─
alter policy orders_update_party on public.orders
  using (
    (user_id = (select auth.uid()))
    or public.member_can(dispensary_id, 'orders')
    or (select is_admin())
  )
  with check (
    (user_id = (select auth.uid()))
    or public.member_can(dispensary_id, 'orders')
    or (select is_admin())
  );

alter policy pos_shifts_all on public.pos_shifts
  using (public.member_can(dispensary_id, 'orders') or is_admin())
  with check (public.member_can(dispensary_id, 'orders') or is_admin());
alter policy pos_staff_all on public.pos_staff
  using (public.member_can(dispensary_id, 'orders') or is_admin())
  with check (public.member_can(dispensary_id, 'orders') or is_admin());

-- ── Listing row itself: owner + manager ─────────────────────────────────────
alter policy dispensaries_update_owner_or_admin on public.dispensaries
  using (public.member_can(id, 'listing') or is_admin())
  with check (public.member_can(id, 'listing') or is_admin());
