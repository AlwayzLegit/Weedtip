-- ════════════════════════════════════════════════════════════════════════════
-- Performance advisor cleanup: unindexed FKs, RLS initplan re-evaluation, and
-- multiple-permissive-policy overlaps. All changes are semantics-preserving —
-- verified by hand against every affected policy's logic before writing this
-- file (see PR description). No security/visibility behavior changes.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

-- ── 1. Unindexed foreign keys (5) ──────────────────────────────────────────
-- Missing covering indexes slow down joins and FK-constraint checks (e.g. on
-- delete of a referenced row). Pure addition, zero behavior change.
create index if not exists idx_ad_events_dispensary_id on public.ad_events(dispensary_id);
create index if not exists idx_ad_events_zone_id on public.ad_events(zone_id);
create index if not exists idx_brand_subscriptions_plan_id on public.brand_subscriptions(plan_id);
create index if not exists idx_dispensary_members_invited_by on public.dispensary_members(invited_by);
create index if not exists idx_review_votes_user_id on public.review_votes(user_id);

-- ── 2. auth_rls_initplan: standalone fixes ─────────────────────────────────
-- Wrapping auth.<fn>() in `(select ...)` lets Postgres cache the result once
-- per statement (InitPlan) instead of re-evaluating per row. Same value,
-- same visibility — pure query-plan optimization. These two policies aren't
-- otherwise restructured below, so they're fixed in place.
alter policy feature_overrides_select on public.dispensary_feature_overrides
  using (
    (exists (
      select 1 from public.dispensaries d
      where d.id = dispensary_feature_overrides.dispensary_id
        and d.owner_id = (select auth.uid())
    )) or is_admin()
  );

alter policy members_select on public.dispensary_members
  using (
    ((select d.owner_id from public.dispensaries d where d.id = dispensary_members.dispensary_id) = (select auth.uid()))
    or (user_id = (select auth.uid()))
    or (lower(email) = lower(coalesce(((select auth.jwt()) ->> 'email'::text), ''::text)))
    or is_admin()
  );

-- ── 3. multiple_permissive_policies: safe mechanical splits (19 tables) ───
-- Pattern: each table has one `cmd = ALL` policy (admin/owner write access)
-- and one `cmd = SELECT` policy (public/scoped read access), both permissive
-- and both applying to SELECT — Postgres evaluates and ORs both, which is
-- the flagged overlap. Verified for every table below that the ALL policy's
-- qual is a strict logical subset of the SELECT policy's qual (i.e. anything
-- the write policy would let through on a read, the read policy already
-- allows independently) — so splitting the ALL policy into INSERT/UPDATE/
-- DELETE-only (dropping its implicit SELECT coverage) changes nothing
-- observable: the SELECT policy alone already covers every row the ALL
-- policy could have. Where the original ALL qual referenced auth.uid()
-- directly, the split also picks up the initplan-safe `(select auth.uid())`
-- form as a bonus.

-- ad_markets (write qual is_admin() ⊆ read qual `true`)
drop policy if exists ad_markets_admin_write on public.ad_markets;
create policy ad_markets_admin_insert on public.ad_markets for insert to public with check (is_admin());
create policy ad_markets_admin_update on public.ad_markets for update to public using (is_admin()) with check (is_admin());
create policy ad_markets_admin_delete on public.ad_markets for delete to public using (is_admin());

-- ad_products (same shape)
drop policy if exists ad_products_admin_write on public.ad_products;
create policy ad_products_admin_insert on public.ad_products for insert to public with check (is_admin());
create policy ad_products_admin_update on public.ad_products for update to public using (is_admin()) with check (is_admin());
create policy ad_products_admin_delete on public.ad_products for delete to public using (is_admin());

-- ad_regions (same shape)
drop policy if exists ad_regions_admin_write on public.ad_regions;
create policy ad_regions_admin_insert on public.ad_regions for insert to public with check (is_admin());
create policy ad_regions_admin_update on public.ad_regions for update to public using (is_admin()) with check (is_admin());
create policy ad_regions_admin_delete on public.ad_regions for delete to public using (is_admin());

-- ad_slots (same shape)
drop policy if exists ad_slots_admin_write on public.ad_slots;
create policy ad_slots_admin_insert on public.ad_slots for insert to public with check (is_admin());
create policy ad_slots_admin_update on public.ad_slots for update to public using (is_admin()) with check (is_admin());
create policy ad_slots_admin_delete on public.ad_slots for delete to public using (is_admin());

-- ad_zones (same shape)
drop policy if exists ad_zones_admin_write on public.ad_zones;
create policy ad_zones_admin_insert on public.ad_zones for insert to public with check (is_admin());
create policy ad_zones_admin_update on public.ad_zones for update to public using (is_admin()) with check (is_admin());
create policy ad_zones_admin_delete on public.ad_zones for delete to public using (is_admin());

-- brand_ad_bids (write qual is_admin() ⊆ read qual `owns_brand(brand_id) OR is_admin()`)
drop policy if exists brand_ad_bids_admin_write on public.brand_ad_bids;
create policy brand_ad_bids_admin_insert on public.brand_ad_bids for insert to public with check (is_admin());
create policy brand_ad_bids_admin_update on public.brand_ad_bids for update to public using (is_admin()) with check (is_admin());
create policy brand_ad_bids_admin_delete on public.brand_ad_bids for delete to public using (is_admin());

-- brand_ad_regions (write qual is_admin() ⊆ read qual `is_active OR is_admin()`)
drop policy if exists brand_ad_regions_write on public.brand_ad_regions;
create policy brand_ad_regions_admin_insert on public.brand_ad_regions for insert to public with check (is_admin());
create policy brand_ad_regions_admin_update on public.brand_ad_regions for update to public using (is_admin()) with check (is_admin());
create policy brand_ad_regions_admin_delete on public.brand_ad_regions for delete to public using (is_admin());

-- brand_products (write qual ⊆ read qual `true`)
drop policy if exists brand_products_write on public.brand_products;
create policy brand_products_write_insert on public.brand_products for insert to public with check (
  is_admin() or (exists (select 1 from public.brands b where b.id = brand_products.brand_id and b.owner_id = (select auth.uid())))
);
create policy brand_products_write_update on public.brand_products for update to public
  using (is_admin() or (exists (select 1 from public.brands b where b.id = brand_products.brand_id and b.owner_id = (select auth.uid()))))
  with check (is_admin() or (exists (select 1 from public.brands b where b.id = brand_products.brand_id and b.owner_id = (select auth.uid()))));
create policy brand_products_write_delete on public.brand_products for delete to public
  using (is_admin() or (exists (select 1 from public.brands b where b.id = brand_products.brand_id and b.owner_id = (select auth.uid()))));

-- brand_subscriptions (write qual is_admin() ⊆ read qual `owns_brand(brand_id) OR is_admin()`)
drop policy if exists brand_subscriptions_admin_write on public.brand_subscriptions;
create policy brand_subscriptions_admin_insert on public.brand_subscriptions for insert to authenticated with check (is_admin());
create policy brand_subscriptions_admin_update on public.brand_subscriptions for update to authenticated using (is_admin()) with check (is_admin());
create policy brand_subscriptions_admin_delete on public.brand_subscriptions for delete to authenticated using (is_admin());

-- brand_updates (write qual ⊆ read qual `true`)
drop policy if exists brand_updates_write on public.brand_updates;
create policy brand_updates_write_insert on public.brand_updates for insert to public with check (
  is_admin() or (exists (select 1 from public.brands b where b.id = brand_updates.brand_id and b.owner_id = (select auth.uid())))
);
create policy brand_updates_write_update on public.brand_updates for update to public
  using (is_admin() or (exists (select 1 from public.brands b where b.id = brand_updates.brand_id and b.owner_id = (select auth.uid()))))
  with check (is_admin() or (exists (select 1 from public.brands b where b.id = brand_updates.brand_id and b.owner_id = (select auth.uid()))));
create policy brand_updates_write_delete on public.brand_updates for delete to public
  using (is_admin() or (exists (select 1 from public.brands b where b.id = brand_updates.brand_id and b.owner_id = (select auth.uid()))));

-- dispensary_feature_overrides (write qual is_admin() ⊆ read qual, fixed in step 2)
drop policy if exists feature_overrides_write on public.dispensary_feature_overrides;
create policy feature_overrides_admin_insert on public.dispensary_feature_overrides for insert to authenticated with check (is_admin());
create policy feature_overrides_admin_update on public.dispensary_feature_overrides for update to authenticated using (is_admin()) with check (is_admin());
create policy feature_overrides_admin_delete on public.dispensary_feature_overrides for delete to authenticated using (is_admin());

-- dispensary_members (write qual ⊆ read qual `owner OR user_id OR email OR is_admin()`, fixed in step 2)
drop policy if exists members_write on public.dispensary_members;
create policy members_write_insert on public.dispensary_members for insert to authenticated with check (
  ((select d.owner_id from public.dispensaries d where d.id = dispensary_members.dispensary_id) = (select auth.uid())) or is_admin()
);
create policy members_write_update on public.dispensary_members for update to authenticated
  using (((select d.owner_id from public.dispensaries d where d.id = dispensary_members.dispensary_id) = (select auth.uid())) or is_admin())
  with check (((select d.owner_id from public.dispensaries d where d.id = dispensary_members.dispensary_id) = (select auth.uid())) or is_admin());
create policy members_write_delete on public.dispensary_members for delete to authenticated
  using (((select d.owner_id from public.dispensaries d where d.id = dispensary_members.dispensary_id) = (select auth.uid())) or is_admin());

-- dispensary_promos (write qual ⊆ read qual)
drop policy if exists dispensary_promos_write on public.dispensary_promos;
create policy dispensary_promos_write_insert on public.dispensary_promos for insert to public with check (owns_dispensary(dispensary_id) or is_admin());
create policy dispensary_promos_write_update on public.dispensary_promos for update to public using (owns_dispensary(dispensary_id) or is_admin()) with check (owns_dispensary(dispensary_id) or is_admin());
create policy dispensary_promos_write_delete on public.dispensary_promos for delete to public using (owns_dispensary(dispensary_id) or is_admin());

-- dispensary_subscriptions (write qual is_admin() ⊆ read qual `owns_dispensary(...) OR is_admin()`)
drop policy if exists subscriptions_write on public.dispensary_subscriptions;
create policy subscriptions_admin_insert on public.dispensary_subscriptions for insert to public with check (is_admin());
create policy subscriptions_admin_update on public.dispensary_subscriptions for update to public using (is_admin()) with check (is_admin());
create policy subscriptions_admin_delete on public.dispensary_subscriptions for delete to public using (is_admin());

-- dispensary_taxes (write qual ⊆ read qual `true`, initplan-optimized in the split)
drop policy if exists dispensary_taxes_write on public.dispensary_taxes;
create policy dispensary_taxes_write_insert on public.dispensary_taxes for insert to authenticated with check (
  (exists (select 1 from public.dispensaries d where d.id = dispensary_taxes.dispensary_id and d.owner_id = (select auth.uid()))) or is_admin()
);
create policy dispensary_taxes_write_update on public.dispensary_taxes for update to authenticated
  using ((exists (select 1 from public.dispensaries d where d.id = dispensary_taxes.dispensary_id and d.owner_id = (select auth.uid()))) or is_admin())
  with check ((exists (select 1 from public.dispensaries d where d.id = dispensary_taxes.dispensary_id and d.owner_id = (select auth.uid()))) or is_admin());
create policy dispensary_taxes_write_delete on public.dispensary_taxes for delete to authenticated
  using ((exists (select 1 from public.dispensaries d where d.id = dispensary_taxes.dispensary_id and d.owner_id = (select auth.uid()))) or is_admin());

-- dispensary_updates (write qual ⊆ read qual)
drop policy if exists dispensary_updates_write on public.dispensary_updates;
create policy dispensary_updates_write_insert on public.dispensary_updates for insert to public with check (owns_dispensary(dispensary_id) or is_admin());
create policy dispensary_updates_write_update on public.dispensary_updates for update to public using (owns_dispensary(dispensary_id) or is_admin()) with check (owns_dispensary(dispensary_id) or is_admin());
create policy dispensary_updates_write_delete on public.dispensary_updates for delete to public using (owns_dispensary(dispensary_id) or is_admin());

-- placements (write qual is_admin() ⊆ read qual `is_active OR is_admin() OR owns_dispensary(...) OR owns_brand(...)`)
drop policy if exists placements_write on public.placements;
create policy placements_admin_insert on public.placements for insert to public with check (is_admin());
create policy placements_admin_update on public.placements for update to public using (is_admin()) with check (is_admin());
create policy placements_admin_delete on public.placements for delete to public using (is_admin());

-- plans (write qual is_admin() ⊆ read qual `is_active OR is_admin()`)
drop policy if exists plans_write on public.plans;
create policy plans_admin_insert on public.plans for insert to public with check (is_admin());
create policy plans_admin_update on public.plans for update to public using (is_admin()) with check (is_admin());
create policy plans_admin_delete on public.plans for delete to public using (is_admin());

-- platform_settings (write qual is_admin() ⊆ read qual `true`)
drop policy if exists platform_settings_write_admin on public.platform_settings;
create policy platform_settings_admin_insert on public.platform_settings for insert to authenticated with check (is_admin());
create policy platform_settings_admin_update on public.platform_settings for update to authenticated using (is_admin()) with check (is_admin());
create policy platform_settings_admin_delete on public.platform_settings for delete to authenticated using (is_admin());

-- ── 4. multiple_permissive_policies: genuine merges (3 tables) ────────────
-- These aren't ALL-vs-SELECT splits — each has two *independent* policies on
-- the same command whose conditions are NOT subsets of each other. Merging
-- them into one OR'd policy is exactly equivalent to Postgres's existing
-- behavior (multiple permissive policies are ORed together already), so this
-- collapses two policies into one without changing which rows are visible.

-- brand_claims: INSERT had both brand_claims_admin (is_admin()) and
-- brand_claims_insert_self (user_id = auth.uid()) — neither is a subset of
-- the other. Merge into the self-service policy; drop the standalone admin
-- ALL policy but re-add its UPDATE/DELETE coverage (nothing else granted those).
drop policy if exists brand_claims_admin on public.brand_claims;
alter policy brand_claims_insert_self on public.brand_claims
  with check ((user_id = (select auth.uid())) or is_admin());
create policy brand_claims_admin_update on public.brand_claims for update to public using (is_admin()) with check (is_admin());
create policy brand_claims_admin_delete on public.brand_claims for delete to public using (is_admin());

-- brands: INSERT had both brands_insert_admin (is_admin()) and
-- brands_insert_self (owner_id = auth.uid() AND status = 'pending') — merge
-- into the self-service policy, drop the standalone admin one. Also apply
-- the (unrelated) auth_rls_initplan fix to brands_select_public here since
-- it's the same table.
drop policy if exists brands_insert_admin on public.brands;
alter policy brands_insert_self on public.brands
  with check (((owner_id = (select auth.uid())) and (status = 'pending'::text)) or is_admin());
alter policy brands_select_public on public.brands
  using ((status = 'active'::text) or (owner_id = (select auth.uid())) or is_admin());

-- dispensaries: SELECT had both dispensaries_select (status='active' OR
-- owner_id=auth.uid() OR is_admin()) and dispensaries_select_owner_or_admin
-- (owns_dispensary(id) OR is_admin()). owns_dispensary() checks literal
-- ownership *or* active dispensary_members staff — a strict superset of the
-- `owner_id = auth.uid()` term, so merging into one policy using
-- owns_dispensary() preserves both the public-active visibility and the
-- (broader, staff-inclusive) owner visibility.
drop policy if exists dispensaries_select_owner_or_admin on public.dispensaries;
alter policy dispensaries_select on public.dispensaries
  using ((status = 'active'::dispensary_status) or owns_dispensary(id) or (select is_admin()));
