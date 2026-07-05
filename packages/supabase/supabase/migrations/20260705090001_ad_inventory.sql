-- 20260705090001_ad_inventory
-- Scarce ad inventory: price book, physical slots, and subscriptions.
--
-- Each region carries fixed inventory: 1 exclusive sponsor, 3 featured,
-- 10 premium. Standard listings are NOT slots — they're the free/organic
-- directory presence (the price book still carries a `standard` row per tier
-- for display). Scarcity is enforced IN THE DATABASE by a partial unique
-- index on ad_subscriptions — never in application code.

create type public.ad_slot_type as enum ('exclusive', 'featured', 'premium', 'standard');

create table public.ad_products (
  id              uuid primary key default extensions.gen_random_uuid(),
  slot_type       public.ad_slot_type not null,
  tier            public.region_tier not null,
  -- Both stored so launch pricing (25–40% of target) can ratchet to list later.
  list_price      integer not null,
  launch_price    integer not null,
  stripe_price_id text,
  constraint ad_products_slot_tier_key unique (slot_type, tier),
  constraint ad_products_prices_nonneg check (list_price >= 0 and launch_price >= 0)
);

comment on table public.ad_products is 'Price book: cents/month per (slot type, region tier). stripe_price_id filled by the Stripe seed script.';

create table public.ad_slots (
  id        uuid primary key default extensions.gen_random_uuid(),
  region_id uuid not null references public.ad_regions (id) on delete cascade,
  slot_type public.ad_slot_type not null,
  position  integer not null,
  constraint ad_slots_region_type_pos_key unique (region_id, slot_type, position),
  constraint ad_slots_no_standard check (slot_type <> 'standard'),
  constraint ad_slots_position_pos check (position >= 1)
);

comment on table public.ad_slots is 'Physical scarce slots, pre-created per region: exclusive 1, featured 1–3, premium 1–10.';

create type public.ad_sub_status as enum ('pending', 'active', 'past_due', 'canceled');

create table public.ad_subscriptions (
  id                     uuid primary key default extensions.gen_random_uuid(),
  slot_id                uuid not null references public.ad_slots (id) on delete restrict,
  dispensary_id          uuid not null references public.dispensaries (id) on delete cascade,
  stripe_subscription_id text,
  status                 public.ad_sub_status not null default 'pending',
  -- Cents/month at signup — records whether launch or list price was paid.
  price_paid             integer not null,
  starts_at              timestamptz,
  ends_at                timestamptz,
  created_at             timestamptz not null default now(),
  constraint ad_subscriptions_stripe_sub_key unique (stripe_subscription_id),
  constraint ad_subscriptions_price_nonneg check (price_paid >= 0)
);

comment on table public.ad_subscriptions is 'Slot claims. Writes go through claim_slot()/service-role routes only; the partial unique index below is the scarcity guarantee.';

-- Hard scarcity: at most one live claim per slot. `canceled` frees the slot
-- instantly for resale.
create unique index one_active_sub_per_slot
  on public.ad_subscriptions (slot_id)
  where status in ('pending', 'active', 'past_due');

create index ad_subscriptions_dispensary_idx on public.ad_subscriptions (dispensary_id);
create index ad_slots_region_idx on public.ad_slots (region_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Price book + slots: public read (availability is the sales pitch), no client writes.
-- Subscriptions: owners read their own; ALL writes via service-role routes.
alter table public.ad_products enable row level security;
alter table public.ad_slots enable row level security;
alter table public.ad_subscriptions enable row level security;

create policy "ad_products_public_read" on public.ad_products for select using (true);
create policy "ad_slots_public_read" on public.ad_slots for select using (true);

create policy "ad_subscriptions_owner_read" on public.ad_subscriptions
  for select using (
    exists (
      select 1 from public.dispensaries d
      where d.id = ad_subscriptions.dispensary_id
        and d.owner_id = (select auth.uid())
    )
    or public.is_admin()
  );
