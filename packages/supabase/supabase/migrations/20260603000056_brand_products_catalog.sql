-- A brand's canonical product catalog: official lineup shown on the brand page,
-- and (later) used to enrich the matching products on dispensary menus.
set search_path = public;

create table if not exists public.brand_products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  category_id uuid references public.categories(id) on delete set null,
  description text,
  image_url text,
  thc_percentage numeric,
  cbd_percentage numeric,
  strain_type public.strain_type,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists brand_products_brand_idx on public.brand_products (brand_id, sort_order);

alter table public.brand_products enable row level security;
create policy brand_products_select on public.brand_products for select using (true);
create policy brand_products_write on public.brand_products
  for all using (
    public.is_admin()
    or exists (select 1 from public.brands b where b.id = brand_products.brand_id and b.owner_id = auth.uid())
  ) with check (
    public.is_admin()
    or exists (select 1 from public.brands b where b.id = brand_products.brand_id and b.owner_id = auth.uid())
  );

-- Optional link from a dispensary's product to its canonical catalog entry, so
-- menus can fall back to the brand's image/description.
alter table public.products
  add column if not exists catalog_id uuid references public.brand_products(id) on delete set null;
