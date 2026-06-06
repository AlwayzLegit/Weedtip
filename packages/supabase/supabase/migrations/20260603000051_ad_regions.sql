-- Advertising regions: admin-defined markets (state, optional city) with a
-- per-term featured rate/floor and a number of featured slots. The bidding layer
-- (highest bid wins, 2-month minimum term) builds on this.
set search_path = public;

create table if not exists public.ad_regions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null unique,
  state char(2) not null,
  city text,
  featured_rate_cents integer not null default 0,
  slots integer not null default 1 check (slots between 1 and 20),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists ad_regions_geo_idx on public.ad_regions (state, city);

alter table public.ad_regions enable row level security;

create policy ad_regions_select on public.ad_regions
  for select using (is_active or public.is_admin());
create policy ad_regions_write on public.ad_regions
  for all using (public.is_admin()) with check (public.is_admin());
