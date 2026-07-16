-- ════════════════════════════════════════════════════════════════════════════
-- 20260716080000_gate_orders_basic_tier
-- Online ordering becomes a Basic-tier feature.
--
-- Enforced in create_order itself (not just startCheckout) because the RPC is
-- called directly by the mobile app. The in-store POS path (create_pos_order) is
-- deliberately NOT gated -- the register is its own paid add-on.
--
-- Body copied verbatim from the live definition; the ONLY change is the tier
-- guard added after the order-type check.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create or replace function public.create_order(
  p_dispensary_id uuid,
  p_order_type public.order_type,
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
  v_reason text;
  v_bogo_id uuid;
  v_bogo_disc integer;
  v_fee_bps integer := 0;
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

  -- Online ordering is a Basic-tier feature. dispensary_tier() already folds in
  -- the grandfathered floor, so listings claimed before Basic existed still pass.
  if public.dispensary_tier(p_dispensary_id) < 1 then
    raise exception 'This dispensary is not set up to take online orders on Weedtip.'
      using errcode = '22023';
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
    if not region.is_medical_legal and not region.is_recreational_legal then
      raise exception 'Cannabis sales are not legal in %, so online ordering is unavailable.', disp.state
        using errcode = '22023';
    end if;
    if region.is_medical_legal and not region.is_recreational_legal and not disp.is_medical then
      raise exception '% licenses medical sales only, and this dispensary is not listed as a medical dispensary.', disp.state
        using errcode = '22023';
    end if;
  end if;

  tax_rate := public.effective_tax_rate(p_dispensary_id);

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
    -- Resolve the code deal (validity window) so we can give a specific
    -- eligibility message rather than a generic "invalid" one.
    select dl.id into v_deal_id
      from public.deals dl
      where dl.dispensary_id = p_dispensary_id
        and dl.code is not null
        and lower(dl.code) = lower(btrim(p_promo_code))
        and dl.is_active = true
        and dl.start_date <= now()
        and dl.end_date >= now()
      limit 1;
    if v_deal_id is null then
      raise exception 'Invalid or expired promo code.' using errcode = '22023';
    end if;
    -- Redemption caps + audience.
    v_reason := public.promo_ineligibility_reason(p_dispensary_id, v_deal_id);
    if v_reason is not null then
      raise exception '%', v_reason using errcode = '22023';
    end if;
    -- Price the (now-eligible) code.
    select cd.discount_cents into discount
      from public.compute_promo_discount(p_dispensary_id, p_promo_code, subtotal) cd;
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

grant execute on function public.create_order(
  uuid, public.order_type, jsonb, text, text, text, text, jsonb
) to authenticated;
