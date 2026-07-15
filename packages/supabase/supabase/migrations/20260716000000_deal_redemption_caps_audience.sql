-- ════════════════════════════════════════════════════════════════════════════
-- 20260716000000_deal_redemption_caps_audience
-- Enforces redemption caps + audience targeting on promo-code deals.
--
-- Reuses the existing (previously unenforced) `per_customer_limit` /
-- `total_limit` columns for the caps, and adds `audience`
-- (all | first_time | return). Enforcement lives in one SECURITY DEFINER
-- eligibility helper — needed because the TOTAL redemption count must see every
-- buyer's rows, while deal_redemptions RLS scopes a shopper to their own — and
-- is called from BOTH compute_promo_discount (so previews agree) and create_order
-- (which raises a specific message: cap reached / wrong audience).
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

-- 1. Audience eligibility on deals.
alter table public.deals
  add column if not exists audience text not null default 'all';

alter table public.deals drop constraint if exists deals_audience_check;
alter table public.deals
  add constraint deals_audience_check check (audience in ('all', 'first_time', 'return'));

-- Legacy new-customer-only deals map onto the first_time audience.
update public.deals set audience = 'first_time'
  where new_customers_only = true and audience = 'all';

-- 2. Eligibility helper. Returns a human reason the current buyer can't use the
--    deal's code (cap reached / audience mismatch), or NULL when it's fine.
--    SECURITY DEFINER so the total-cap count spans all buyers.
create or replace function public.promo_ineligibility_reason(
  p_dispensary_id uuid,
  p_deal_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  dl record;
  v_total integer;
  v_mine integer;
  v_prior integer;
begin
  if uid is null then
    return null; -- anonymous callers can't create an order anyway
  end if;

  select per_customer_limit, total_limit, audience
    into dl
    from public.deals
    where id = p_deal_id and dispensary_id = p_dispensary_id;
  if not found then
    return null;
  end if;

  -- Total redemption cap (across every customer).
  if dl.total_limit is not null then
    select count(*) into v_total from public.deal_redemptions where deal_id = p_deal_id;
    if v_total >= dl.total_limit then
      return 'This promo code has reached its redemption limit.';
    end if;
  end if;

  -- Per-customer cap (this buyer's redemptions of this deal).
  if dl.per_customer_limit is not null then
    select count(*) into v_mine
      from public.deal_redemptions
      where deal_id = p_deal_id and user_id = uid;
    if v_mine >= dl.per_customer_limit then
      return 'You have already used this promo code the maximum number of times.';
    end if;
  end if;

  -- Audience: first_time = no prior non-cancelled orders here; return = ≥1.
  if dl.audience in ('first_time', 'return') then
    select count(*) into v_prior
      from public.orders
      where dispensary_id = p_dispensary_id and user_id = uid and status <> 'cancelled';
    if dl.audience = 'first_time' and v_prior > 0 then
      return 'This promo code is for first-time customers only.';
    elsif dl.audience = 'return' and v_prior = 0 then
      return 'This promo code is for returning customers only.';
    end if;
  end if;

  return null;
end;
$$;
grant execute on function public.promo_ineligibility_reason(uuid, uuid) to authenticated, anon;

-- 3. compute_promo_discount: unchanged pricing, plus an eligibility guard so a
--    capped/ineligible code yields no discount for the current buyer (body copied
--    from the live function; only the guard is added).
create or replace function public.compute_promo_discount(
  p_dispensary_id uuid,
  p_code text,
  p_subtotal_cents integer
)
returns table(deal_id uuid, title text, discount_cents integer)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  d record;
begin
  if p_code is null or btrim(p_code) = '' then
    return;
  end if;

  select dl.id, dl.title, dl.discount_type, dl.discount_value
    into d
    from public.deals dl
    where dl.dispensary_id = p_dispensary_id
      and dl.code is not null
      and lower(dl.code) = lower(btrim(p_code))
      and dl.is_active = true
      and dl.start_date <= now()
      and dl.end_date >= now()
    limit 1;

  if not found then
    return;
  end if;

  -- Redemption caps + audience eligibility for the current buyer.
  if public.promo_ineligibility_reason(p_dispensary_id, d.id) is not null then
    return;
  end if;

  deal_id := d.id;
  title := d.title;
  if d.discount_type = 'percentage' then
    discount_cents := least(round(p_subtotal_cents * d.discount_value / 100.0)::int, p_subtotal_cents);
  elsif d.discount_type = 'fixed' then
    discount_cents := least((d.discount_value * 100)::int, p_subtotal_cents);
  else
    discount_cents := 0;
  end if;

  return next;
end;
$$;
grant execute on function public.compute_promo_discount(uuid, text, integer) to authenticated, anon;

-- 4. create_order: body copied verbatim from the live definition; ONLY the
--    promo-code branch changes — it now rejects an ineligible code with a
--    specific message (cap reached / wrong audience) instead of silently
--    dropping it. Everything else (item pricing, tax, auto/BOGO, insert,
--    redemption ledger) is unchanged.
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
