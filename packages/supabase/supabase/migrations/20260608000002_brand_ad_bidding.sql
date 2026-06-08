-- Brand-side featured auction: mirrors the dispensary ad_regions/ad_bids model.
-- Brands bid per state for a limited number of "Featured brand" slots; top bids
-- win, with a 2-month minimum term. Surfaced on the /brands directory.
set search_path = public;

create table if not exists public.brand_ad_regions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null unique,
  state char(2) not null unique,
  featured_rate_cents integer not null default 0,
  slots integer not null default 3 check (slots between 1 and 20),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.brand_ad_regions enable row level security;
create policy brand_ad_regions_select on public.brand_ad_regions
  for select using (is_active or public.is_admin());
create policy brand_ad_regions_write on public.brand_ad_regions
  for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.brand_ad_bids (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.brand_ad_regions(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  bid_cents integer not null check (bid_cents >= 0),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  contract_start timestamptz not null default now(),
  contract_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists brand_ad_bids_one_active
  on public.brand_ad_bids (region_id, brand_id) where status = 'active';
create index if not exists brand_ad_bids_rank_idx
  on public.brand_ad_bids (region_id, status, bid_cents desc);

alter table public.brand_ad_bids enable row level security;
create policy brand_ad_bids_select on public.brand_ad_bids
  for select using (public.owns_brand(brand_id) or public.is_admin());
create policy brand_ad_bids_admin_write on public.brand_ad_bids
  for all using (public.is_admin()) with check (public.is_admin());

-- Place / update a brand's bid in a state region (highest bids win the slots).
create or replace function public.place_brand_bid(
  p_region_id uuid, p_brand_id uuid, p_bid_cents integer
) returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.owns_brand(p_brand_id) and not public.is_admin() then
    raise exception 'Not authorized for this brand' using errcode = '42501';
  end if;
  select * into r from public.brand_ad_regions where id = p_region_id and is_active;
  if not found then raise exception 'Region not found' using errcode = 'P0002'; end if;
  if p_bid_cents < r.featured_rate_cents then
    raise exception 'Bid is below the region floor' using errcode = '22023';
  end if;
  insert into public.brand_ad_bids (region_id, brand_id, bid_cents, contract_end)
  values (p_region_id, p_brand_id, p_bid_cents, now() + interval '2 months')
  on conflict (region_id, brand_id) where status = 'active'
  do update set bid_cents = excluded.bid_cents, updated_at = now();
end; $$;
revoke all on function public.place_brand_bid(uuid, uuid, integer) from public, anon;
grant execute on function public.place_brand_bid(uuid, uuid, integer) to authenticated;

create or replace function public.cancel_brand_bid(p_bid_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b record;
begin
  select * into b from public.brand_ad_bids where id = p_bid_id;
  if not found then raise exception 'Bid not found' using errcode = 'P0002'; end if;
  if not public.owns_brand(b.brand_id) and not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if now() < b.contract_end and not public.is_admin() then
    raise exception 'You are committed to this region until %', b.contract_end::date using errcode = '22023';
  end if;
  update public.brand_ad_bids set status = 'cancelled', updated_at = now() where id = p_bid_id;
end; $$;
revoke all on function public.cancel_brand_bid(uuid) from public, anon;
grant execute on function public.cancel_brand_bid(uuid) to authenticated;

-- Every active region with this brand's bid + the price needed to hold a slot.
create or replace function public.brand_bids_for_owner(p_brand_id uuid)
returns table (
  region_id uuid, region_name text, state char(2), slots integer,
  floor_cents integer, min_winning_cents integer, your_bid_cents integer,
  your_bid_id uuid, contract_end timestamptz, is_winning boolean
) language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_brand(p_brand_id) and not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
  select r.id, r.name, r.state, r.slots, r.featured_rate_cents,
    greatest(
      r.featured_rate_cents,
      coalesce((
        select b2.bid_cents from public.brand_ad_bids b2
        where b2.region_id = r.id and b2.status = 'active'
        order by b2.bid_cents desc, b2.created_at
        offset greatest(r.slots - 1, 0) limit 1
      ), 0)
    ) as min_winning,
    yb.bid_cents, yb.id, yb.contract_end,
    (yb.bid_cents is not null and (
      select count(*) from public.brand_ad_bids b3
      where b3.region_id = r.id and b3.status = 'active' and b3.bid_cents > yb.bid_cents
    ) < r.slots) as is_winning
  from public.brand_ad_regions r
  left join public.brand_ad_bids yb
    on yb.region_id = r.id and yb.brand_id = p_brand_id and yb.status = 'active'
  where r.is_active
  order by r.name;
end; $$;
revoke all on function public.brand_bids_for_owner(uuid) from public, anon;
grant execute on function public.brand_bids_for_owner(uuid) to authenticated;

-- Winning brands for a state → featured on /brands. Only ids (no amounts).
create or replace function public.region_featured_brands(p_state char(2))
returns table (brand_id uuid)
language sql stable security definer set search_path = public as $$
  with ranked as (
    select b.brand_id,
      rank() over (partition by b.region_id order by b.bid_cents desc, b.created_at) as rnk,
      r.slots
    from public.brand_ad_bids b
    join public.brand_ad_regions r on r.id = b.region_id
    where b.status = 'active' and r.is_active and r.state = p_state
  )
  select distinct brand_id from ranked where rnk <= slots;
$$;
grant execute on function public.region_featured_brands(char) to anon, authenticated;

-- Seed a brand market per legal state (admins can adjust slots/floor later).
insert into public.brand_ad_regions (name, slug, state, featured_rate_cents, slots)
select o.state || ' Featured Brands', lower(o.state) || '-featured-brands', o.state, 15000, 3
from public.operating_regions o
where (o.is_recreational_legal or o.is_medical_legal)
on conflict (state) do nothing;
