-- ════════════════════════════════════════════════════════════════════════════
-- 20260714090000_monetization_integrity
--
-- Fixes the "Fix now" cluster from the monetization audit: the sales-led model
-- was enforced in app code while the database said otherwise. Every change
-- here is valid against CURRENT prod (pre-20260713150000) and idempotent, so
-- it can ship ahead of the pricing-reset migration.
--
--   1. Brand-bid self-activation (CRITICAL): place_brand_bid is SECURITY
--      DEFINER, granted to `authenticated`, and inserts with the column
--      default status='active' — any brand owner could self-grant a free,
--      immediately-live featured-brand slot via a direct RPC call, bypassing
--      the sales-led pending→invoice→activate flow. Revoke it from
--      anon/authenticated (sales-led requestBrandBid + admin activate_brand_bid
--      remain), and flip the status default to 'pending' as defense in depth.
--
--   2. is_paid_listing leaks paid perks (CRITICAL): the subscription arm
--      counts ANY status='active' row, including the $0 Free plan (every
--      dispensary gets one). So the "no competitor cross-promo" Growth perk
--      and the paid-listing nearby-rail gate leak to every free listing. Now
--      requires the plan's price_cents > 0.
--
--   3. Growth requests are impossible (HIGH): dispensary_subscriptions' status
--      CHECK omits 'pending', so the entire sales-led plan flow throws in prod.
--      Add 'pending'.
--
--   4. Permanent 0% commission (HIGH): create_order still derives a 5% fee
--      (plan commission_bps, else 500 fallback). The model is 0% forever —
--      pin v_fee_bps := 0 and backfill any non-zero rows.
--
--   5. placements.status (HIGH): "pending billing request" was encoded as the
--      ambiguous (is_active=false AND ends_at IS NULL) — identical to a paused
--      evergreen placement, so /admin/billing and /admin/promotions collided.
--      Add an explicit status column.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Brand-bid lockdown ───────────────────────────────────────────────────
revoke execute on function public.place_brand_bid(uuid, uuid, integer)
  from public, anon, authenticated;
alter table public.brand_ad_bids alter column status set default 'pending';

-- ─── 2. is_paid_listing requires a PAID plan ─────────────────────────────────
create or replace function public.is_paid_listing(p_dispensary_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.dispensary_subscriptions s
    join public.plans pl on pl.id = s.plan_id
    where s.dispensary_id = p_dispensary_id
      and s.status = 'active'
      and pl.price_cents > 0
      and (s.current_period_end is null or s.current_period_end >= now())
  )
  or exists (
    select 1 from public.placements p
    where p.dispensary_id = p_dispensary_id
      and p.is_active
      and p.starts_at <= now()
      and (p.ends_at is null or p.ends_at >= now())
  );
$$;

-- ─── 3. Allow 'pending' subscriptions ────────────────────────────────────────
alter table public.dispensary_subscriptions
  drop constraint if exists dispensary_subscriptions_status_check;
alter table public.dispensary_subscriptions
  add constraint dispensary_subscriptions_status_check
  check (status in ('pending', 'active', 'past_due', 'canceled'));

-- ─── 4. Permanent 0% commission in create_order ──────────────────────────────
-- Same signature/body as prod, with the fee derivation pinned to 0. Columns
-- are kept for auditability; the plan lookup + 500 fallback are removed.
create or replace function public.create_order(
  p_dispensary_id uuid,
  p_order_type order_type,
  p_items jsonb,
  p_notes text default null,
  p_promo_code text default null,
  p_source text default 'web',
  p_device text default null,
  p_delivery_address jsonb default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  disp record;
  region record;
  tax_rate numeric := 0.15;
  line jsonb;
  prod record;
  v_unit integer;
  snapshot jsonb := '[]'::jsonb;
  subtotal integer := 0;
  discount integer := 0;
  discounted integer;
  v_deal_id uuid := null;
  v_code text := null;
  v_bogo_id uuid;
  v_bogo_disc integer;
  v_fee_bps integer := 0;  -- Weedtip is 0% commission, permanently.
  v_fee integer := 0;
  tax integer;
  total integer;
  new_id uuid;
  qty integer;
  v_addr jsonb := null;
  v_source text := case when p_source in ('web', 'embed', 'mobile_web') then p_source else 'web' end;
  v_device text := case when p_device in ('desktop', 'mobile', 'tablet') then p_device else null end;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.' using errcode = '22023';
  end if;

  select * into disp from public.dispensaries d where d.id = p_dispensary_id;
  if not found then
    raise exception 'Dispensary not found.' using errcode = 'P0002';
  end if;
  if not ((p_order_type = 'delivery' and disp.is_delivery)
       or (p_order_type = 'pickup'   and disp.is_pickup)) then
    raise exception 'This dispensary does not offer % orders.', p_order_type using errcode = '22023';
  end if;

  if p_order_type = 'delivery' then
    v_addr := jsonb_strip_nulls(jsonb_build_object(
      'street', nullif(left(btrim(coalesce(p_delivery_address ->> 'street', '')), 120), ''),
      'unit',   nullif(left(btrim(coalesce(p_delivery_address ->> 'unit', '')), 40), ''),
      'city',   nullif(left(btrim(coalesce(p_delivery_address ->> 'city', '')), 80), ''),
      'state',  nullif(upper(left(btrim(coalesce(p_delivery_address ->> 'state', '')), 2)), ''),
      'zip',    nullif(left(btrim(coalesce(p_delivery_address ->> 'zip', '')), 10), ''),
      'phone',  nullif(left(btrim(coalesce(p_delivery_address ->> 'phone', '')), 20), '')
    ));
    if v_addr ->> 'street' is null or v_addr ->> 'city' is null
       or v_addr ->> 'zip' is null or v_addr ->> 'phone' is null then
      raise exception 'A delivery address with street, city, zip, and phone is required for delivery orders.'
        using errcode = '22023';
    end if;
  end if;

  select * into region from public.operating_regions r where r.state = disp.state;
  if found then
    tax_rate := region.tax_rate;
    if not region.is_medical_legal and not region.is_recreational_legal then
      raise exception 'Cannabis sales are not legal in %, so online ordering is unavailable.', disp.state
        using errcode = '22023';
    end if;
    if region.is_medical_legal and not region.is_recreational_legal and not disp.is_medical then
      raise exception '% licenses medical sales only, and this dispensary is not listed as a medical dispensary.', disp.state
        using errcode = '22023';
    end if;
  end if;

  for line in select value from jsonb_array_elements(p_items) loop
    qty := coalesce((line ->> 'quantity')::int, 0);
    if qty <= 0 or qty > 99 then
      raise exception 'Invalid quantity.' using errcode = '22023';
    end if;

    select id, name, price_cents, in_stock
      into prod
      from public.products
      where id = (line ->> 'product_id')::uuid
        and dispensary_id = p_dispensary_id;

    if not found then
      raise exception 'A product in your cart is no longer available.' using errcode = '22023';
    end if;
    if not prod.in_stock then
      raise exception '"%" is out of stock.', prod.name using errcode = '22023';
    end if;

    select unit_cents into v_unit from public.effective_unit_price(prod.id);

    subtotal := subtotal + v_unit * qty;
    snapshot := snapshot || jsonb_build_object(
      'product_id', prod.id,
      'name', prod.name,
      'quantity', qty,
      'unit_price_cents', v_unit
    );
  end loop;

  if p_promo_code is not null and btrim(p_promo_code) <> '' then
    select cd.deal_id, cd.discount_cents
      into v_deal_id, discount
      from public.compute_promo_discount(p_dispensary_id, p_promo_code, subtotal) cd;
    if v_deal_id is null then
      raise exception 'Invalid or expired promo code.' using errcode = '22023';
    end if;
    v_code := btrim(p_promo_code);
  else
    select ad.deal_id, ad.discount_cents
      into v_deal_id, discount
      from public.compute_auto_order_discount(p_dispensary_id, subtotal) ad;
    select bd.deal_id, bd.discount_cents
      into v_bogo_id, v_bogo_disc
      from public.compute_bogo_discount(p_dispensary_id, p_items) bd;
    if coalesce(v_bogo_disc, 0) > coalesce(discount, 0) then
      v_deal_id := v_bogo_id;
      discount := v_bogo_disc;
    end if;
    if v_deal_id is not null then
      v_code := 'AUTO';
    end if;
  end if;

  discounted := subtotal - coalesce(discount, 0);
  tax := round(discounted * tax_rate);
  total := discounted + tax;

  perform set_config('app.orders_trusted', '1', true);

  insert into public.orders (
    user_id, dispensary_id, status, order_type, items,
    subtotal_cents, discount_cents, tax_cents, total_cents, deal_id, notes,
    platform_fee_cents, platform_fee_bps, source, device, delivery_address
  )
  values (
    uid, p_dispensary_id, 'pending', p_order_type, snapshot,
    subtotal, coalesce(discount, 0), tax, total, v_deal_id, p_notes,
    v_fee, v_fee_bps, v_source, v_device, v_addr
  )
  returning id into new_id;

  if v_deal_id is not null and discount > 0 then
    insert into public.deal_redemptions (deal_id, order_id, user_id, dispensary_id, code, discount_cents)
    values (v_deal_id, new_id, uid, p_dispensary_id, coalesce(v_code, 'AUTO'), discount);
  end if;

  return new_id;
end;
$$;

-- Backfill any historical non-zero fees (orders_write_guard freezes these
-- columns, so bypass it with the trusted flag inside this transaction).
do $$
begin
  perform set_config('app.orders_trusted', '1', true);
  update public.orders
    set platform_fee_cents = 0, platform_fee_bps = 0
    where platform_fee_cents <> 0 or platform_fee_bps <> 0;
end $$;

-- ─── 5. placements.status (explicit pending vs live) ─────────────────────────
alter table public.placements
  add column if not exists status text not null default 'active'
  check (status in ('pending', 'active', 'canceled'));

-- Existing rows: a placement that has never gone live (is_active=false AND
-- ends_at IS NULL) is a sales-led request → 'pending'; everything else is a
-- real placement whose live/paused state is is_active.
update public.placements
  set status = 'pending'
  where is_active = false and ends_at is null;
