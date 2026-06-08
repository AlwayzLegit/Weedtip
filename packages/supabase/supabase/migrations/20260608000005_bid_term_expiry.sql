-- Fix "featured forever": a paid/active bid must also be within its term
-- (contract_end > now) to win a slot. Re-placing a bid renews the term.
set search_path = public;

-- ── Surfacing: only in-term active bids feature ──────────────────────────────
create or replace function public.region_featured_brands(p_state char(2))
returns table (brand_id uuid)
language sql stable security definer set search_path = public as $$
  with ranked as (
    select b.brand_id,
      rank() over (partition by b.region_id order by b.bid_cents desc, b.created_at) as rnk,
      r.slots
    from public.brand_ad_bids b
    join public.brand_ad_regions r on r.id = b.region_id
    where b.status = 'active' and b.contract_end > now() and r.is_active and r.state = p_state
  )
  select distinct brand_id from ranked where rnk <= slots;
$$;

create or replace function public.region_featured_dispensaries(p_state char(2), p_city text default null)
returns table (dispensary_id uuid)
language sql stable security definer set search_path = public as $$
  with ranked as (
    select b.dispensary_id, b.region_id,
      rank() over (partition by b.region_id order by b.bid_cents desc, b.created_at) as rnk,
      r.slots
    from public.ad_bids b
    join public.ad_regions r on r.id = b.region_id
    where b.status = 'active' and b.contract_end > now() and r.is_active and r.state = p_state
      and (r.city is null or (p_city is not null and lower(r.city) = lower(p_city)))
  )
  select distinct dispensary_id from ranked where rnk <= slots;
$$;

-- ── Owner views: min-winning and is_winning consider only in-term bids ────────
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
        where b2.region_id = r.id and b2.status = 'active' and b2.contract_end > now()
        order by b2.bid_cents desc, b2.created_at
        offset greatest(r.slots - 1, 0) limit 1
      ), 0)
    ) as min_winning,
    yb.bid_cents, yb.id, yb.contract_end,
    (yb.bid_cents is not null and yb.contract_end > now() and (
      select count(*) from public.brand_ad_bids b3
      where b3.region_id = r.id and b3.status = 'active' and b3.contract_end > now()
        and b3.bid_cents > yb.bid_cents
    ) < r.slots) as is_winning
  from public.brand_ad_regions r
  left join public.brand_ad_bids yb
    on yb.region_id = r.id and yb.brand_id = p_brand_id and yb.status = 'active'
  where r.is_active
  order by r.name;
end; $$;

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
        where b2.region_id = r.id and b2.status = 'active' and b2.contract_end > now()
        order by b2.bid_cents desc, b2.created_at
        offset greatest(r.slots - 1, 0) limit 1
      ), 0)
    ) as min_winning,
    yb.bid_cents, yb.id, yb.contract_end,
    (yb.bid_cents is not null and yb.contract_end > now() and (
      select count(*) from public.ad_bids b3
      where b3.region_id = r.id and b3.status = 'active' and b3.contract_end > now()
        and b3.bid_cents > yb.bid_cents
    ) < r.slots) as is_winning
  from public.ad_regions r
  left join public.ad_bids yb
    on yb.region_id = r.id and yb.dispensary_id = p_dispensary_id and yb.status = 'active'
  where r.is_active and r.state = dd.state
    and (r.city is null or lower(r.city) = lower(coalesce(dd.city, '')))
  order by r.name;
end; $$;

-- ── Free-path re-bid renews the term (paid path already does via activate_*) ──
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
  do update set bid_cents = excluded.bid_cents, contract_end = now() + interval '2 months', updated_at = now();
end; $$;

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
  do update set bid_cents = excluded.bid_cents, contract_end = now() + interval '2 months', updated_at = now();
end; $$;
