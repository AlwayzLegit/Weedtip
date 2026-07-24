-- Collapse the plan ladder to two tiers: Free + a single paid plan,
-- "Weedtip Pro" at $39/mo with every feature (incl. featured placement in the
-- shop's region). Application code (lib/plan.ts) collapses any DB rank >= 1 to
-- the single `paid` tier, so this migration only needs to reshape the catalog.
--
-- Legacy Basic ($29, tier 1) / Growth ($99, tier 2) / Premium (tier 2) plans are
-- DEACTIVATED but kept in place: existing dispensary_subscriptions and
-- brand_subscriptions reference their plan_id, and dispensary_tier()/brand_tier()
-- still read plans.tier through that FK — so current paying shops keep their
-- access (they resolve to `paid`) and nothing dangles.

-- 1) Retire the old paid plans from the picker (rows stay for FK/tier resolution).
update public.plans
set is_active = false
where slug in ('basic', 'growth', 'premium');

-- 2) The single paid plan. tier 1 (→ `paid` in app code); flat price, no
--    per-order commission; features[] is the marketed list on the plan card.
insert into public.plans
  (slug, name, description, price_cents, tier, is_active, sort_order, commission_bps, features)
values (
  'pro',
  'Weedtip Pro',
  'Everything to run and grow your listing — one flat monthly price.',
  3900,
  1,
  true,
  1,
  0,
  '[
    "Online orders (pickup & delivery)",
    "Website link & Google Business sync",
    "Complete profile — photos, video, amenities",
    "Bulk CSV & POS menu import",
    "Deals, promo codes & in-store promos",
    "Follower updates & broadcasts",
    "Advanced analytics",
    "Tax configuration",
    "Team members",
    "Featured placement in your region"
  ]'::jsonb
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  tier = excluded.tier,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  commission_bps = excluded.commission_bps,
  features = excluded.features;

-- 3) Keep Free tidy and honest at the top of the picker.
update public.plans
set sort_order = 0,
    commission_bps = 0,
    features = '[
      "Claim & verify your listing",
      "Name, logo, phone & hours",
      "One cover photo",
      "Manual menu items",
      "Always free — 0% commission"
    ]'::jsonb
where slug = 'free';
