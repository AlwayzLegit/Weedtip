-- ════════════════════════════════════════════════════════════════════════════
-- 20260713150000_retire_stripe_pricing_reset
--
-- Weedtip's payment model: shoppers NEVER pay through the platform. Pickup
-- orders are paid at the store; delivery orders are paid to the dispensary's
-- delivery partner. Weedtip's revenue is 100% B2B — dispensaries and brands
-- pay for plans and visibility. Card processing moves to a PaymentCloud
-- gateway later; until then billing is sales-led (pending requests that the
-- admin console activates and invoices).
--
-- This migration retires Stripe completely and resets the price book:
--   1. active_placements view rebuilt without stripe_* columns.
--   2. The three functions referencing stripe_* rewritten:
--      activate_brand_bid (no payment-intent arg), release_stale_ad_claims
--      (7-day window — pending now means "sales request", not "abandoned
--      card checkout"), orders_write_guard (no stripe column freezes).
--   3. All stripe_* columns dropped (zero rows referenced them).
--   4. Pricing reset (competitor-anchored: Weedmaps standard listings run
--      ~$300–1,500/mo, Leafly ~$600+/mo; premium placement in hot markets
--      $10k+. Weedtip: the LISTING IS FREE, orders carry 0% commission, and
--      paid visibility starts at ~10–20% of competitor rates):
--        • Plans: Free ($0, everything needed to sell) and Growth ($99/mo
--          launch) — the old Plus/Premium pair is retired. commission_bps = 0
--          on every plan, permanently.
--        • ad_products 'standard' rows → $0 (the free listing IS the
--          standard tier; it is never sold).
--        • ad_regions exclusive bands aligned to the tier price book
--          (launch–list): A+ $1,500–5,000 · A $1,050–3,500 · B+/B $600–2,000.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. active_placements without stripe columns ─────────────────────────────
drop view if exists public.active_placements;
create view public.active_placements as
select id, dispensary_id, type, target_id, scope_state, scope_city, priority,
       starts_at, ends_at, is_active, price_cents, notes, created_at, brand_id
from public.placements
where is_active and starts_at <= now() and (ends_at is null or ends_at >= now());
grant select on public.active_placements to anon, authenticated;

-- ─── 2. Rewritten functions ──────────────────────────────────────────────────
drop function if exists public.activate_brand_bid(uuid, text);
create function public.activate_brand_bid(p_bid_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare b record;
begin
  select * into b from public.brand_ad_bids where id = p_bid_id and status = 'pending';
  if not found then return; end if;
  delete from public.brand_ad_bids
    where region_id = b.region_id and brand_id = b.brand_id and status = 'active' and id <> p_bid_id;
  update public.brand_ad_bids
    set status = 'active', contract_start = now(), contract_end = now() + interval '2 months',
        paid_at = now(), updated_at = now()
    where id = p_bid_id;
end; $$;
revoke all on function public.activate_brand_bid(uuid) from public, anon, authenticated;
grant execute on function public.activate_brand_bid(uuid) to service_role;

-- Pending ad-slot claims are now sales requests awaiting activation, not
-- abandoned card checkouts — hold the slot for 7 days instead of 30 minutes.
create or replace function public.release_stale_ad_claims()
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.ad_subscriptions
  set status = 'canceled', ends_at = now()
  where status = 'pending'
    and created_at < now() - interval '7 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.orders_write_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  is_buyer boolean;
begin
  if current_user = 'service_role'
     or coalesce(current_setting('app.orders_trusted', true), '') = '1' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Orders must be placed through checkout.' using errcode = '42501';
  end if;

  if new.subtotal_cents   is distinct from old.subtotal_cents
  or new.tax_cents        is distinct from old.tax_cents
  or new.total_cents      is distinct from old.total_cents
  or new.discount_cents   is distinct from old.discount_cents
  or new.platform_fee_cents is distinct from old.platform_fee_cents
  or new.platform_fee_bps is distinct from old.platform_fee_bps
  or new.items            is distinct from old.items
  or new.deal_id          is distinct from old.deal_id
  or new.order_type       is distinct from old.order_type
  or new.source           is distinct from old.source
  or new.device           is distinct from old.device
  or new.dispensary_id    is distinct from old.dispensary_id
  or new.user_id          is distinct from old.user_id
  or new.created_at       is distinct from old.created_at then
    raise exception 'Order financials cannot be modified.' using errcode = '42501';
  end if;

  is_buyer := old.user_id = uid
              and not public.owns_dispensary(old.dispensary_id)
              and not public.is_admin();

  if is_buyer then
    if new.status is distinct from old.status then
      if new.status <> 'cancelled' or old.status not in ('pending', 'confirmed') then
        raise exception 'You can only cancel an order that has not been fulfilled.'
          using errcode = '42501';
      end if;
    end if;
    if new.payment_status is distinct from old.payment_status
    or new.paid_at        is distinct from old.paid_at
    or new.sold_by_staff  is distinct from old.sold_by_staff then
      raise exception 'Payment status is set by the dispensary, not the buyer.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- ─── 3. Drop every stripe_* column ───────────────────────────────────────────
alter table public.orders
  drop column if exists stripe_session_id,
  drop column if exists stripe_payment_intent_id;
alter table public.dispensary_subscriptions
  drop column if exists stripe_customer_id,
  drop column if exists stripe_subscription_id;
alter table public.placements
  drop column if exists stripe_session_id,
  drop column if exists stripe_payment_intent_id;
alter table public.brand_ad_bids
  drop column if exists stripe_session_id,
  drop column if exists stripe_payment_intent_id;
alter table public.ad_subscriptions
  drop column if exists stripe_subscription_id;
alter table public.ad_products
  drop column if exists stripe_price_id;

-- ─── 4. Pricing reset ────────────────────────────────────────────────────────
-- Free: everything a dispensary needs to sell. This is the acquisition wedge —
-- competitors charge hundreds/month for a listing with a menu and ordering.
update public.plans
set description = 'Everything you need to get orders. Free forever.',
    features = '["Full listing with menu & photos", "Unlimited pickup & delivery orders", "0% order commission — always", "Deals & promo codes", "Customer reviews", "Basic analytics"]'::jsonb,
    commission_bps = 0,
    sort_order = 1,
    is_active = true
where slug = 'free' or name = 'Free';

-- Plus → Growth, $99/mo launch (list $199 in marketing copy). One paid plan.
update public.plans
set slug = 'growth',
    name = 'Growth',
    description = 'Own your page and know your market. About a sixth of what the other guys charge for less.',
    price_cents = 9900,
    features = '["Everything in Free", "Advanced analytics & demand insights", "No competitor cross-promo on your page", "POS register included", "Embeddable menu for your website", "Verified badge", "Priority support", "CSV exports"]'::jsonb,
    commission_bps = 0,
    sort_order = 2,
    is_active = true
where slug = 'plus' or name = 'Plus';

-- Retire the old Premium plan (its ranking perks now live in region ad slots).
update public.plans
set is_active = false, commission_bps = 0
where slug = 'premium' or name = 'Premium';

-- The free listing IS the standard tier — never sold, shown as $0.
update public.ad_products
set launch_price = 0, list_price = 0
where slot_type = 'standard';

-- Exclusive sponsorship bands follow the tier price book (launch → list).
update public.ad_regions
set exclusive_price_min = case tier
      when 'A_PLUS' then 150000 when 'A' then 105000 else 60000 end,
    exclusive_price_max = case tier
      when 'A_PLUS' then 500000 when 'A' then 350000 else 200000 end;
