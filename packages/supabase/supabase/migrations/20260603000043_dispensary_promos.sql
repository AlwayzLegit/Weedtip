-- In-store promos: non-menu promotional offers (veteran/first-time discounts,
-- vendor days, ladies' night) the owner ranks on their storefront. Distinct from
-- menu deals — no discount math, claimed in person.
set search_path = public;

create table if not exists public.dispensary_promos (
  id uuid primary key default gen_random_uuid(),
  dispensary_id uuid not null references public.dispensaries(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (description is null or char_length(description) <= 1000),
  image_url text,
  start_date date,
  end_date date,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dispensary_promos_idx on public.dispensary_promos (dispensary_id, sort_order);

create trigger dispensary_promos_set_updated_at
  before update on public.dispensary_promos
  for each row execute function public.set_updated_at();

alter table public.dispensary_promos enable row level security;

-- Live promos are public; owners/admins see all of theirs.
create policy dispensary_promos_select on public.dispensary_promos
  for select using (
    (is_active
      and (start_date is null or start_date <= current_date)
      and (end_date is null or end_date >= current_date))
    or public.owns_dispensary(dispensary_id)
    or public.is_admin()
  );
create policy dispensary_promos_write on public.dispensary_promos
  for all
  using (public.owns_dispensary(dispensary_id) or public.is_admin())
  with check (public.owns_dispensary(dispensary_id) or public.is_admin());
