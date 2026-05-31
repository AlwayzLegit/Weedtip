-- ════════════════════════════════════════════════════════════════════════════
-- 20260530000003_indexes
-- Indexes for geo queries, full-text + trigram search, and FK/filter lookups.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

-- ─── dispensaries ────────────────────────────────────────────────────────────
-- Geo: ST_DWithin / ST_Distance radius queries.
create index dispensaries_location_gix on public.dispensaries using gist (location);
-- Full-text relevance.
create index dispensaries_search_gix on public.dispensaries using gin (search_vector);
-- Typo-tolerant name matching (autocomplete / fuzzy).
create index dispensaries_name_trgm on public.dispensaries using gin (name extensions.gin_trgm_ops);
-- Common storefront filters: only active dispensaries are public.
create index dispensaries_status_idx on public.dispensaries (status);
create index dispensaries_owner_idx on public.dispensaries (owner_id);
-- Featured listings surfaced first.
create index dispensaries_featured_idx on public.dispensaries (featured) where featured;
create index dispensaries_state_idx on public.dispensaries (state);

-- ─── products ────────────────────────────────────────────────────────────────
-- Menu lookups by dispensary, filtered by category.
create index products_dispensary_category_idx on public.products (dispensary_id, category_id);
create index products_category_idx on public.products (category_id);
create index products_search_gix on public.products using gin (search_vector);
create index products_name_trgm on public.products using gin (name extensions.gin_trgm_ops);
create index products_strain_idx on public.products (strain_type) where strain_type is not null;
create index products_featured_idx on public.products (is_featured) where is_featured;
-- Price-range browsing over in-stock items.
create index products_instock_price_idx on public.products (in_stock, price_cents);

-- ─── deals ───────────────────────────────────────────────────────────────────
create index deals_dispensary_idx on public.deals (dispensary_id);
-- Active deals within their date window.
create index deals_active_window_idx on public.deals (is_active, start_date, end_date);

-- ─── reviews ─────────────────────────────────────────────────────────────────
create index reviews_dispensary_idx on public.reviews (dispensary_id);
create index reviews_user_idx on public.reviews (user_id);

-- ─── favorites ───────────────────────────────────────────────────────────────
-- PK is (user_id, dispensary_id); add the reverse for "who favorited this shop".
create index favorites_dispensary_idx on public.favorites (dispensary_id);

-- ─── orders ──────────────────────────────────────────────────────────────────
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_dispensary_idx on public.orders (dispensary_id, created_at desc);
create index orders_status_idx on public.orders (status);
