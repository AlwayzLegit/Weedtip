-- ════════════════════════════════════════════════════════════════════════════
-- 20260531000014_brands
-- Brand directory (Weedmaps-style). Products link to a brand; the free-text
-- `brand` column is retained for un-linked products / display fallback.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create table public.brands (
  id          uuid primary key default extensions.gen_random_uuid(),
  name        text not null,
  slug        text not null,
  description text,
  logo_url    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint brands_slug_key unique (slug),
  constraint brands_name_key unique (name)
);

create trigger brands_set_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();

alter table public.brands enable row level security;

create policy brands_select_public on public.brands
  for select to anon, authenticated using (true);
create policy brands_insert_admin on public.brands
  for insert to authenticated with check (public.is_admin());
create policy brands_update_admin on public.brands
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy brands_delete_admin on public.brands
  for delete to authenticated using (public.is_admin());

alter table public.products
  add column brand_id uuid references public.brands (id) on delete set null;
create index products_brand_id_idx on public.products (brand_id);

insert into public.brands (name, slug, description) values
  ('Cookies', 'cookies', 'Iconic lifestyle cannabis brand known for cookie-family genetics.'),
  ('Stiiizy', 'stiiizy', 'Popular vape and concentrate brand with a sleek pod system.'),
  ('Raw Garden', 'raw-garden', 'Clean, single-source live-resin concentrates and carts.'),
  ('Wyld', 'wyld', 'Real-fruit cannabis gummies and edibles.'),
  ('Kiva', 'kiva', 'Award-winning chocolates, mints, and edibles.')
on conflict (slug) do nothing;
