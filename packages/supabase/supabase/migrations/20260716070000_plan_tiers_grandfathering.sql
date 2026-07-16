-- ════════════════════════════════════════════════════════════════════════════
-- 20260716070000_plan_tiers_grandfathering
-- Freemium re-architecture, foundation.
--
-- Introduces an explicit plan TIER rank so features can require a minimum tier
-- rather than a boolean "is paid":
--   0 = Free    — claim/verify, name+logo+phone+hours, one cover, manual products
--   1 = Basic   — + online orders, website link, Google sync, complete profile,
--                   CSV import + store sync
--   2 = Growth  — + deals, promos, updates, analytics, taxes, team
--
-- GRANDFATHERING: everything in tier 1 used to be free, so every ALREADY-claimed
-- listing is flagged `grandfathered` and keeps tier-1 access for free. New claims
-- get the new gating. Admins can toggle the flag per account.
--
-- Additive + backwards-compatible: is_paid_listing() already treats any paid
-- subscription as "paid", so Basic unlocks the public website link with no change.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

-- 1. Tier rank on plans.
alter table public.plans add column if not exists tier smallint not null default 0;
alter table public.plans drop constraint if exists plans_tier_range;
alter table public.plans add constraint plans_tier_range check (tier between 0 and 2);

update public.plans set tier = case slug
  when 'free' then 0
  when 'basic' then 1
  when 'growth' then 2
  when 'premium' then 2
  else 0
end;

-- 2. The new entry paid tier.
insert into public.plans (slug, name, description, price_cents, commission_bps, tier, sort_order, is_active, features)
values (
  'basic', 'Basic',
  'Take orders online, show your website, sync Google Business, and complete your profile.',
  2900, 0, 1, 1, true,
  '["Online orders","Website link on your listing","Google Business sync","Complete profile","CSV import + store sync","0% commission"]'::jsonb
)
on conflict (slug) do update
  set price_cents = excluded.price_cents,
      commission_bps = excluded.commission_bps,
      tier = excluded.tier,
      is_active = excluded.is_active;

-- Keep the ladder ordered: Free, Basic, Growth, Premium.
update public.plans set sort_order = case slug
  when 'free' then 0 when 'basic' then 1 when 'growth' then 2 when 'premium' then 3
  else sort_order end;

-- 3. Grandfather every listing that is already claimed today.
alter table public.dispensaries
  add column if not exists grandfathered boolean not null default false;

update public.dispensaries set grandfathered = true where owner_id is not null;

comment on column public.dispensaries.grandfathered is
  'Claimed before the Basic tier existed: keeps tier-1 (orders, website, Google sync, complete profile, bulk import) for free.';

-- 4. Effective tier for a dispensary: the best of its active subscription and
--    its grandfathered floor. SECURITY DEFINER so the checkout path can call it
--    for any shop regardless of the caller's RLS view of subscriptions.
create or replace function public.dispensary_tier(p_dispensary_id uuid)
returns smallint
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    coalesce((
      select pl.tier
      from public.dispensary_subscriptions s
      join public.plans pl on pl.id = s.plan_id
      where s.dispensary_id = p_dispensary_id
        and s.status = 'active'
        and (s.current_period_end is null or s.current_period_end >= now())
      order by pl.tier desc
      limit 1
    ), 0),
    coalesce((
      select case when d.grandfathered then 1 else 0 end
      from public.dispensaries d where d.id = p_dispensary_id
    ), 0)
  )::smallint;
$$;
grant execute on function public.dispensary_tier(uuid) to anon, authenticated;
