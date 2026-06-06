-- Regional ad bidding: advertisers bid per region; the top `slots` active bids
-- win the featured positions. A new bid commits to a 2-month minimum term; after
-- that it keeps competing (and can be withdrawn).
set search_path = public;

create table if not exists public.ad_bids (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.ad_regions(id) on delete cascade,
  dispensary_id uuid not null references public.dispensaries(id) on delete cascade,
  bid_cents integer not null check (bid_cents >= 0),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  contract_start timestamptz not null default now(),
  contract_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ad_bids_one_active
  on public.ad_bids (region_id, dispensary_id) where status = 'active';
create index if not exists ad_bids_rank_idx
  on public.ad_bids (region_id, status, bid_cents desc);

alter table public.ad_bids enable row level security;
create policy ad_bids_select on public.ad_bids
  for select using (public.owns_dispensary(dispensary_id) or public.is_admin());
create policy ad_bids_admin_write on public.ad_bids
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.place_ad_bid(
  p_region_id uuid, p_dispensary_id uuid, p_bid_cents integer
) returns void language plpgsql security definer set search_path = public as $$
declare r record; d record;
begin
  if not public.owns_dispensary(p_dispensary_id) and not public.is_admin() then
    raise exception 'Not authorized for this dispensary' using errcode = '42501';
  end if;
  select * into r from public.ad_regions where id = p_region_id and is_active;
  if not found then raise exception 'Region not found' using errcode = 'P0002'; end if;
  if p_bid_cents < r.featured_rate_cents then
    raise exception 'Bid is below the region floor' using errcode = '22023';
  end if;
  select state, city into d from public.dispensaries where id = p_dispensary_id;
  if d.state <> r.state or (r.city is not null and lower(r.city) <> lower(coalesce(d.city, ''))) then
    raise exception 'Your shop is not in this region' using errcode = '22023';
  end if;

  insert into public.ad_bids (region_id, dispensary_id, bid_cents, contract_end)
  values (p_region_id, p_dispensary_id, p_bid_cents, now() + interval '2 months')
  on conflict (region_id, dispensary_id) where status = 'active'
  do update set bid_cents = excluded.bid_cents, updated_at = now();
end; $$;
revoke all on function public.place_ad_bid(uuid, uuid, integer) from public, anon;
grant execute on function public.place_ad_bid(uuid, uuid, integer) to authenticated;

create or replace function public.cancel_ad_bid(p_bid_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b record;
begin
  select * into b from public.ad_bids where id = p_bid_id;
  if not found then raise exception 'Bid not found' using errcode = 'P0002'; end if;
  if not public.owns_dispensary(b.dispensary_id) and not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if now() < b.contract_end and not public.is_admin() then
    raise exception 'You are committed to this region until %', b.contract_end::date using errcode = '22023';
  end if;
  update public.ad_bids set status = 'cancelled', updated_at = now() where id = p_bid_id;
end; $$;
revoke all on function public.cancel_ad_bid(uuid) from public, anon;
grant execute on function public.cancel_ad_bid(uuid) to authenticated;

create or replace function public.ad_bids_for_owner(p_dispensary_id uuid)
returns table (
  region_id uuid, region_name text, state char(2), city text, slots integer,
  floor_cents integer, min_winning_cents integer, your_bid_cents integer,
  your_bid_id uuid, contract_end timestamptz, is_winning boolean
) language plpgsql security definer set search_path = public as $$
declare dd record;
begin
  if not public.owns_dispensary(p_dispensary_id) and not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select state, city into dd from public.dispensaries where id = p_dispensary_id;
  return query
  select r.id, r.name, r.state, r.city, r.slots, r.featured_rate_cents,
    greatest(
      r.featured_rate_cents,
      coalesce((
        select b2.bid_cents from public.ad_bids b2
        where b2.region_id = r.id and b2.status = 'active'
        order by b2.bid_cents desc, b2.created_at
        offset greatest(r.slots - 1, 0) limit 1
      ), 0)
    ) as min_winning,
    yb.bid_cents, yb.id, yb.contract_end,
    (yb.bid_cents is not null and (
      select count(*) from public.ad_bids b3
      where b3.region_id = r.id and b3.status = 'active' and b3.bid_cents > yb.bid_cents
    ) < r.slots) as is_winning
  from public.ad_regions r
  left join public.ad_bids yb
    on yb.region_id = r.id and yb.dispensary_id = p_dispensary_id and yb.status = 'active'
  where r.is_active and r.state = dd.state
    and (r.city is null or lower(r.city) = lower(coalesce(dd.city, '')))
  order by r.name;
end; $$;
revoke all on function public.ad_bids_for_owner(uuid) from public, anon;
grant execute on function public.ad_bids_for_owner(uuid) to authenticated;
