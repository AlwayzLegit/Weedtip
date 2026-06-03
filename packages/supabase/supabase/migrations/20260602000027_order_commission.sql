-- ════════════════════════════════════════════════════════════════════════════
-- 20260602000027_order_commission
-- Marketplace take-rate on orders (Weedmaps WM Orders-style transaction fees).
-- The platform records a commission on each order's merchandise revenue. The
-- rate is tiered by plan — higher tiers pay a lower take-rate, an upgrade
-- incentive. The fee does NOT change the customer's total; it's the commission
-- the dispensary owes the platform, captured server-side for reporting/payouts.
-- (Automated split payouts would layer Stripe Connect on top of this later.)
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

-- Per-tier commission rate, in basis points (100 bps = 1%).
alter table public.plans add column commission_bps integer not null default 500;
update public.plans set commission_bps = case slug
  when 'free' then 500
  when 'plus' then 300
  when 'premium' then 150
  else 500
end;

-- Per-order fee + the rate snapshot it was computed at (auditability).
alter table public.orders
  add column platform_fee_cents integer not null default 0,
  add column platform_fee_bps integer not null default 0;

-- Recreate create_order to compute + store the commission. Signature is
-- unchanged, so replace in place. Fee base is the post-discount, pre-tax
-- merchandise subtotal — the platform doesn't take a cut of tax.
create or replace function public.create_order(
  p_dispensary_id uuid,
  p_order_type public.order_type,
  p_items jsonb,
  p_notes text default null,
  p_promo_code text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tax_rate numeric := 0.15;  -- keep in sync with @weedtip/shared ESTIMATED_TAX_RATE
  line jsonb;
  prod record;
  snapshot jsonb := '[]'::jsonb;
  subtotal integer := 0;
  discount integer := 0;
  discounted integer;
  v_deal_id uuid := null;
  v_fee_bps integer;
  v_fee integer;
  tax integer;
  total integer;
  new_id uuid;
  qty integer;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.' using errcode = '22023';
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

    subtotal := subtotal + prod.price_cents * qty;
    snapshot := snapshot || jsonb_build_object(
      'product_id', prod.id,
      'name', prod.name,
      'quantity', qty,
      'unit_price_cents', prod.price_cents
    );
  end loop;

  -- Promo code: validate + price the discount via the shared helper.
  if p_promo_code is not null and btrim(p_promo_code) <> '' then
    select cd.deal_id, cd.discount_cents
      into v_deal_id, discount
      from public.compute_promo_discount(p_dispensary_id, p_promo_code, subtotal) cd;
    if v_deal_id is null then
      raise exception 'Invalid or expired promo code.' using errcode = '22023';
    end if;
  end if;

  discounted := subtotal - coalesce(discount, 0);
  tax := round(discounted * tax_rate);
  total := discounted + tax;

  -- Platform commission from the dispensary's active plan (default 5%).
  v_fee_bps := coalesce(
    (select pl.commission_bps
       from public.dispensary_subscriptions ds
       join public.plans pl on pl.id = ds.plan_id
       where ds.dispensary_id = p_dispensary_id and ds.status = 'active'
       limit 1),
    500);
  v_fee := round(discounted * v_fee_bps / 10000.0);

  insert into public.orders (
    user_id, dispensary_id, status, order_type, items,
    subtotal_cents, discount_cents, tax_cents, total_cents, deal_id, notes,
    platform_fee_cents, platform_fee_bps
  )
  values (
    uid, p_dispensary_id, 'pending', p_order_type, snapshot,
    subtotal, coalesce(discount, 0), tax, total, v_deal_id, p_notes,
    v_fee, v_fee_bps
  )
  returning id into new_id;

  if v_deal_id is not null and discount > 0 then
    insert into public.deal_redemptions (deal_id, order_id, user_id, dispensary_id, code, discount_cents)
    values (v_deal_id, new_id, uid, p_dispensary_id, btrim(p_promo_code), discount);
  end if;

  return new_id;
end;
$$;

grant execute on function public.create_order(uuid, public.order_type, jsonb, text, text)
  to authenticated;
