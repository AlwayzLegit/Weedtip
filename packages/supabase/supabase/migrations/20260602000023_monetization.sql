-- ════════════════════════════════════════════════════════════════════════════
-- 20260602000023_monetization
-- Marketplace monetization foundation (entitlements-first; Stripe layered on
-- later). Three pillars:
--   • plans + dispensary_subscriptions — recurring listing tiers
--   • placements — time-boxed, geo-scoped paid promotions: featured, homepage
--     hero, promoted deal/product
-- Featured ranking already keys off dispensaries.featured, so we split that into
-- featured_manual (admin intent) + a synced effective flag driven by live
-- featured placements, so paid features expire on their own.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create type public.placement_type as enum (
  'featured','hero','promoted_deal','promoted_product'
);

-- ─── Subscription tiers ──────────────────────────────────────────────────────
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  price_cents integer not null default 0,   -- per month
  features jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.dispensary_subscriptions (
  id uuid primary key default gen_random_uuid(),
  dispensary_id uuid not null unique references public.dispensaries(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  status text not null default 'active' check (status in ('active','past_due','canceled')),
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Paid placements ─────────────────────────────────────────────────────────
create table public.placements (
  id uuid primary key default gen_random_uuid(),
  dispensary_id uuid not null references public.dispensaries(id) on delete cascade,
  type public.placement_type not null,
  target_id uuid,                 -- deal/product id for promoted_*; null otherwise
  scope_state text,               -- null = nationwide
  scope_city text,                -- null = whole state / nationwide
  priority integer not null default 0,   -- higher ranks first (hero slot order)
  starts_at timestamptz not null default now(),
  ends_at timestamptz,            -- null = open-ended
  is_active boolean not null default true,
  price_cents integer not null default 0,
  stripe_payment_intent_id text,
  stripe_session_id text,
  notes text,
  created_at timestamptz not null default now()
);
create index placements_live_idx on public.placements (type, is_active, starts_at, ends_at);
create index placements_dispensary_idx on public.placements (dispensary_id);
create index placements_target_idx on public.placements (target_id);

-- Split admin's manual featured intent from the effective (synced) flag.
alter table public.dispensaries add column featured_manual boolean not null default false;
update public.dispensaries set featured_manual = featured;

-- ─── Effective-featured sync ─────────────────────────────────────────────────
-- featured = manual intent OR a currently-live featured placement. SECURITY
-- DEFINER so it can write the admin-guarded column; safe because it only ORs in
-- derived state.
create or replace function public.sync_featured_flags(p_dispensary_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.dispensaries d
  set featured = d.featured_manual or exists (
    select 1 from public.placements p
    where p.dispensary_id = d.id
      and p.type = 'featured'
      and p.is_active
      and p.starts_at <= now()
      and (p.ends_at is null or p.ends_at >= now())
  )
  where p_dispensary_id is null or d.id = p_dispensary_id;
end;
$$;
revoke all on function public.sync_featured_flags(uuid) from public, anon;
grant execute on function public.sync_featured_flags(uuid) to authenticated;

-- Live-placement convenience view (RLS of the caller applies).
create view public.active_placements
with (security_invoker = true) as
select * from public.placements
where is_active and starts_at <= now() and (ends_at is null or ends_at >= now());

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.plans enable row level security;
create policy plans_select on public.plans
  for select using (is_active or public.is_admin());
create policy plans_write on public.plans
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.dispensary_subscriptions enable row level security;
create policy subscriptions_select on public.dispensary_subscriptions
  for select using (public.owns_dispensary(dispensary_id) or public.is_admin());
create policy subscriptions_write on public.dispensary_subscriptions
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.placements enable row level security;
create policy placements_select on public.placements
  for select using (is_active or public.is_admin() or public.owns_dispensary(dispensary_id));
create policy placements_write on public.placements
  for all using (public.is_admin()) with check (public.is_admin());

-- ─── Seed default tiers (owner-editable in admin) ────────────────────────────
insert into public.plans (slug, name, description, price_cents, features, sort_order) values
  ('free', 'Free', 'Basic listing to get discovered.', 0,
   '["Public profile","Menu listing","Customer reviews"]'::jsonb, 0),
  ('plus', 'Plus', 'Everything to run online ordering and grow.', 4900,
   '["Everything in Free","Online ordering","Deals & promo codes","Analytics dashboard","Order CSV export"]'::jsonb, 1),
  ('premium', 'Premium', 'Maximum reach with priority support.', 14900,
   '["Everything in Plus","Priority search ranking","Included featured days/month","Dedicated support","Early access to new features"]'::jsonb, 2);

-- ─── Auto-expire featured via pg_cron when available (best-effort) ────────────
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('sync-featured-flags', '*/5 * * * *', 'select public.sync_featured_flags()');
  end if;
exception when others then
  -- pg_cron unavailable or already scheduled; placement actions still sync on write.
  null;
end;
$$;
