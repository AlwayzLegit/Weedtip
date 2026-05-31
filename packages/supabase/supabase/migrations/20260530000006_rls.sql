-- ════════════════════════════════════════════════════════════════════════════
-- 20260530000006_rls
-- Row Level Security for every table. Access control lives here, never frontend-only.
--
-- Roles: `anon` (unauthenticated visitors) and `authenticated` (signed-in users).
-- Predicates use the SECURITY DEFINER helpers from 0004 (is_admin, auth_role,
-- owns_dispensary) which read base tables without recursing through these policies.
--
-- Model summary:
--   • Public storefront (anon + authenticated): read active dispensaries, their
--     products & deals, all categories, reviews, and operating regions.
--   • Consumers: manage own profile/favorites; create reviews & orders for self.
--   • Dispensary owners: full CRUD on their own dispensary, products, deals; read
--     and update orders for their dispensary. (status/featured are admin-only —
--     enforced by trigger in 0004.)
--   • Admins: everything.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── profiles ────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy profiles_select_self_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy profiles_update_self_or_admin on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- ─── dispensaries ────────────────────────────────────────────────────────────
alter table public.dispensaries enable row level security;

-- Public storefront: anyone sees active listings.
create policy dispensaries_select_public on public.dispensaries
  for select to anon, authenticated
  using (status = 'active');

-- Owners see their own (any status); admins see all.
create policy dispensaries_select_owner_or_admin on public.dispensaries
  for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- Only dispensary owners (for themselves) or admins may create listings.
create policy dispensaries_insert_owner on public.dispensaries
  for insert to authenticated
  with check (
    (owner_id = auth.uid() and public.auth_role() = 'dispensary_owner')
    or public.is_admin()
  );

create policy dispensaries_update_owner_or_admin on public.dispensaries
  for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

create policy dispensaries_delete_owner_or_admin on public.dispensaries
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- ─── categories ──────────────────────────────────────────────────────────────
alter table public.categories enable row level security;

create policy categories_select_public on public.categories
  for select to anon, authenticated
  using (true);

create policy categories_insert_admin on public.categories
  for insert to authenticated with check (public.is_admin());

create policy categories_update_admin on public.categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy categories_delete_admin on public.categories
  for delete to authenticated using (public.is_admin());

-- ─── products ────────────────────────────────────────────────────────────────
alter table public.products enable row level security;

-- Public: products of active dispensaries.
create policy products_select_public on public.products
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.dispensaries d
      where d.id = products.dispensary_id and d.status = 'active'
    )
  );

-- Owner of the parent dispensary (any status) or admin.
create policy products_select_owner_or_admin on public.products
  for select to authenticated
  using (public.owns_dispensary(dispensary_id) or public.is_admin());

create policy products_insert_owner_or_admin on public.products
  for insert to authenticated
  with check (public.owns_dispensary(dispensary_id) or public.is_admin());

create policy products_update_owner_or_admin on public.products
  for update to authenticated
  using (public.owns_dispensary(dispensary_id) or public.is_admin())
  with check (public.owns_dispensary(dispensary_id) or public.is_admin());

create policy products_delete_owner_or_admin on public.products
  for delete to authenticated
  using (public.owns_dispensary(dispensary_id) or public.is_admin());

-- ─── deals ───────────────────────────────────────────────────────────────────
alter table public.deals enable row level security;

create policy deals_select_public on public.deals
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.dispensaries d
      where d.id = deals.dispensary_id and d.status = 'active'
    )
  );

create policy deals_select_owner_or_admin on public.deals
  for select to authenticated
  using (public.owns_dispensary(dispensary_id) or public.is_admin());

create policy deals_insert_owner_or_admin on public.deals
  for insert to authenticated
  with check (public.owns_dispensary(dispensary_id) or public.is_admin());

create policy deals_update_owner_or_admin on public.deals
  for update to authenticated
  using (public.owns_dispensary(dispensary_id) or public.is_admin())
  with check (public.owns_dispensary(dispensary_id) or public.is_admin());

create policy deals_delete_owner_or_admin on public.deals
  for delete to authenticated
  using (public.owns_dispensary(dispensary_id) or public.is_admin());

-- ─── reviews ─────────────────────────────────────────────────────────────────
alter table public.reviews enable row level security;

-- Reviews are public.
create policy reviews_select_public on public.reviews
  for select to anon, authenticated
  using (true);

-- A user may review (once — enforced by unique constraint) an active dispensary, as themselves.
create policy reviews_insert_self on public.reviews
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.dispensaries d
      where d.id = reviews.dispensary_id and d.status = 'active'
    )
  );

create policy reviews_update_author on public.reviews
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy reviews_delete_author_or_admin on public.reviews
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ─── favorites ───────────────────────────────────────────────────────────────
alter table public.favorites enable row level security;

create policy favorites_select_self on public.favorites
  for select to authenticated
  using (user_id = auth.uid());

create policy favorites_insert_self on public.favorites
  for insert to authenticated
  with check (user_id = auth.uid());

create policy favorites_delete_self on public.favorites
  for delete to authenticated
  using (user_id = auth.uid());

-- ─── orders ──────────────────────────────────────────────────────────────────
alter table public.orders enable row level security;

-- The buyer, the dispensary owner, or an admin can read an order.
create policy orders_select_party on public.orders
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.owns_dispensary(dispensary_id)
    or public.is_admin()
  );

-- Buyers create orders for themselves at active dispensaries.
create policy orders_insert_self on public.orders
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.dispensaries d
      where d.id = orders.dispensary_id and d.status = 'active'
    )
  );

-- Buyer (e.g. cancel), dispensary owner (advance status), or admin can update.
create policy orders_update_party on public.orders
  for update to authenticated
  using (
    user_id = auth.uid()
    or public.owns_dispensary(dispensary_id)
    or public.is_admin()
  )
  with check (
    user_id = auth.uid()
    or public.owns_dispensary(dispensary_id)
    or public.is_admin()
  );

create policy orders_delete_admin on public.orders
  for delete to authenticated
  using (public.is_admin());

-- ─── operating_regions ───────────────────────────────────────────────────────
alter table public.operating_regions enable row level security;

create policy operating_regions_select_public on public.operating_regions
  for select to anon, authenticated
  using (true);

create policy operating_regions_insert_admin on public.operating_regions
  for insert to authenticated with check (public.is_admin());

create policy operating_regions_update_admin on public.operating_regions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy operating_regions_delete_admin on public.operating_regions
  for delete to authenticated using (public.is_admin());

-- ─── RPC execution grants ────────────────────────────────────────────────────
-- Search is part of the public storefront.
grant execute on function public.search_dispensaries(
  text, double precision, double precision, double precision,
  boolean, boolean, boolean, boolean, boolean, text, integer, integer
) to anon, authenticated;

grant execute on function public.search_products(
  text, text, public.strain_type, uuid, integer, integer, boolean, integer, integer
) to anon, authenticated;

grant execute on function public.is_dispensary_open(jsonb, timestamptz) to anon, authenticated;
