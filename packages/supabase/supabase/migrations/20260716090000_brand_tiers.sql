-- ════════════════════════════════════════════════════════════════════════════
-- 20260716090000_brand_tiers
-- Brands get the same Free/Basic/Growth ladder as dispensaries.
--
-- Brands had NO subscription model at all (monetized only via placements/bids),
-- so "gate brands like dispensaries" needs a subscription table first. This adds
-- it, mirroring dispensary_subscriptions, plus the same grandfathered floor:
-- every brand claimed before Basic existed keeps tier-1 access for free.
--
-- Reuses the shared `plans` ladder (tier 0/1/2) — one price list for both sides.
-- Additive: nothing is gated by this migration.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create table if not exists public.brand_subscriptions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null unique references public.brands(id) on delete cascade,
  plan_id uuid references public.plans(id),
  status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brand_subscriptions_brand_idx on public.brand_subscriptions (brand_id);

alter table public.brand_subscriptions enable row level security;

-- Owners see their own brand's subscription; admins manage every row (billing is
-- sales-led, so activation happens in /admin/billing, never self-serve).
drop policy if exists brand_subscriptions_select on public.brand_subscriptions;
create policy brand_subscriptions_select on public.brand_subscriptions
  for select to authenticated
  using (public.owns_brand(brand_id) or public.is_admin());

drop policy if exists brand_subscriptions_admin_write on public.brand_subscriptions;
create policy brand_subscriptions_admin_write on public.brand_subscriptions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Grandfather every brand that is already claimed today.
alter table public.brands
  add column if not exists grandfathered boolean not null default false;

update public.brands set grandfathered = true where owner_id is not null;

comment on column public.brands.grandfathered is
  'Claimed before the Basic tier existed: keeps tier-1 Brand Studio access for free.';

-- Effective tier for a brand — same shape as dispensary_tier().
create or replace function public.brand_tier(p_brand_id uuid)
returns smallint
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    coalesce((
      select pl.tier
      from public.brand_subscriptions s
      join public.plans pl on pl.id = s.plan_id
      where s.brand_id = p_brand_id
        and s.status = 'active'
        and (s.current_period_end is null or s.current_period_end >= now())
      order by pl.tier desc
      limit 1
    ), 0),
    coalesce((
      select case when b.grandfathered then 1 else 0 end
      from public.brands b where b.id = p_brand_id
    ), 0)
  )::smallint;
$$;
grant execute on function public.brand_tier(uuid) to anon, authenticated;
