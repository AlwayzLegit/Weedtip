-- ════════════════════════════════════════════════════════════════════════════
-- 20260719250000_ads_v2_definer_fix
-- QA CRITICALS: slot_price_cents + get_region_placements join ad_subscriptions
-- (owner-or-admin SELECT RLS) but were SECURITY INVOKER, so the anon/static
-- callers saw zero subs — the public rate card always quoted launch price
-- while checkout (service role) charged the stepped price, and
-- get_region_placements returned NOTHING to shoppers (no paid or house
-- placements served). SECURITY DEFINER fixes both; each exposes only
-- aggregates/active-holder ids — no prices paid, no pending holds.
-- Verified as anon: stepped price + placements (incl. is_house) visible.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create or replace function public.slot_price_cents(
  p_region_id uuid,
  p_slot_type public.ad_slot_type
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with product as (
    select p.launch_price, p.list_price
    from public.ad_products p
    join public.ad_regions r on r.tier = p.tier
    where r.id = p_region_id and p.slot_type = p_slot_type
    limit 1
  ),
  claimed as (
    select count(*)::int as n
    from public.ad_subscriptions s
    join public.ad_slots sl on sl.id = s.slot_id
    where sl.region_id = p_region_id
      and sl.slot_type = p_slot_type
      and s.status in ('pending', 'active', 'past_due')
      and not s.is_house
  )
  select least(
    round(product.launch_price * power(1.15, claimed.n))::int,
    product.list_price
  )
  from product, claimed;
$$;
grant execute on function public.slot_price_cents(uuid, public.ad_slot_type) to anon, authenticated;

drop function if exists public.get_region_placements(uuid);
create function public.get_region_placements(p_region_id uuid)
returns table (
  slot_type     public.ad_slot_type,
  "position"    integer,
  dispensary_id uuid,
  is_house      boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select s.slot_type, s.position, sub.dispensary_id, sub.is_house
  from public.ad_slots s
  join public.ad_subscriptions sub on sub.slot_id = s.id and sub.status = 'active'
  where s.region_id = p_region_id
  order by
    case s.slot_type when 'exclusive' then 0 when 'featured' then 1 else 2 end,
    s.position;
$$;
grant execute on function public.get_region_placements(uuid) to anon, authenticated;
