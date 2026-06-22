-- Performance hardening — addresses Supabase performance advisors.
-- Idempotent.

-- 1) unindexed_foreign_keys — covering index for each FK column so joins and
--    referential-action checks don't seq-scan the child table.
create index if not exists ad_bids_dispensary_id_idx            on public.ad_bids (dispensary_id);
create index if not exists brand_ad_bids_brand_id_idx           on public.brand_ad_bids (brand_id);
create index if not exists brand_claims_user_id_idx             on public.brand_claims (user_id);
create index if not exists brand_products_category_id_idx       on public.brand_products (category_id);
create index if not exists deal_redemptions_user_id_idx         on public.deal_redemptions (user_id);
create index if not exists dispensary_subscriptions_plan_id_idx on public.dispensary_subscriptions (plan_id);
create index if not exists orders_deal_id_idx                   on public.orders (deal_id);
create index if not exists orders_sold_by_staff_idx             on public.orders (sold_by_staff);
create index if not exists pos_shifts_closed_by_idx             on public.pos_shifts (closed_by);
create index if not exists pos_shifts_opened_by_idx             on public.pos_shifts (opened_by);
create index if not exists products_catalog_id_idx             on public.products (catalog_id);
create index if not exists strain_favorites_strain_id_idx       on public.strain_favorites (strain_id);

-- 2) multiple_permissive_policies — on the hot, per-page-load tables the public
--    SELECT policy and the owner/admin SELECT policy were two separate permissive
--    policies, both evaluated per row for authenticated users. Merge each pair
--    into one policy (logical OR — identical access), with row-independent auth
--    calls wrapped as init-plan subqueries. Tiny config tables are left as-is.

-- dispensaries
drop policy if exists dispensaries_select_public         on public.dispensaries;
drop policy if exists dispensaries_select_owner_or_admin on public.dispensaries;
create policy dispensaries_select on public.dispensaries
  for select to anon, authenticated
  using (
    status = 'active'::dispensary_status
    or owner_id = (select auth.uid())
    or (select is_admin())
  );

-- products
drop policy if exists products_select_public         on public.products;
drop policy if exists products_select_owner_or_admin on public.products;
create policy products_select on public.products
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.dispensaries d
      where d.id = products.dispensary_id and d.status = 'active'::dispensary_status
    )
    or owns_dispensary(dispensary_id)
    or (select is_admin())
  );

-- deals
drop policy if exists deals_select_public         on public.deals;
drop policy if exists deals_select_owner_or_admin on public.deals;
create policy deals_select on public.deals
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.dispensaries d
      where d.id = deals.dispensary_id and d.status = 'active'::dispensary_status
    )
    or owns_dispensary(dispensary_id)
    or (select is_admin())
  );
