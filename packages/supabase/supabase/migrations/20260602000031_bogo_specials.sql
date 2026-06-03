-- ════════════════════════════════════════════════════════════════════════════
-- 20260602000031_bogo_specials
-- BOGO ("buy N get M at X% off") auto-apply specials, per-product semantics:
-- within each qualifying line item, every (buy_quantity + get_quantity) units
-- earns get_quantity units at get_discount_percent off (100 = free). Evaluated
-- over the cart at checkout, picking the best eligible BOGO deal. Folded into
-- the same single order-discount slot as spend_threshold (codes still win).
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create or replace function public.compute_bogo_discount(
  p_dispensary_id uuid,
  p_items jsonb
)
returns table (deal_id uuid, title text, discount_cents integer)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  d record;
  cur integer;
  best_disc integer := 0;
  best_id uuid := null;
  best_title text := null;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return;
  end if;

  for d in
    select *
    from public.deals dl
    where dl.dispensary_id = p_dispensary_id
      and dl.kind = 'bogo'
      and dl.auto_apply
      and dl.is_active
      and now() between dl.start_date and dl.end_date
      and (cardinality(dl.days_of_week) = 0
           or extract(dow from now())::smallint = any(dl.days_of_week))
      and (dl.time_start is null or dl.time_end is null
           or now()::time between dl.time_start and dl.time_end)
      and coalesce(dl.buy_quantity, 0) > 0
      and coalesce(dl.get_quantity, 0) > 0
  loop
    select coalesce(round(sum(
        floor(it.quantity::numeric / (d.buy_quantity + d.get_quantity))
        * d.get_quantity
        * eff.unit_cents
        * coalesce(d.get_discount_percent, 100) / 100.0
      ))::int, 0)
      into cur
      from jsonb_to_recordset(p_items) as it(product_id uuid, quantity int)
      join public.products p on p.id = it.product_id and p.dispensary_id = p_dispensary_id
      cross join lateral public.effective_unit_price(p.id) eff
      where it.quantity >= (d.buy_quantity + d.get_quantity)
        and (
          d.target_scope = 'menu'
          or (d.target_scope = 'category' and p.category_id = any(d.target_category_ids))
          or (d.target_scope = 'brand' and p.brand_id is not null and p.brand_id = any(d.target_brand_ids))
          or (d.target_scope = 'products' and p.id = any(d.target_product_ids))
        )
        and not (p.id = any(d.exclude_product_ids));

    if cur > best_disc then
      best_disc := cur;
      best_id := d.id;
      best_title := d.title;
    end if;
  end loop;

  if best_disc <= 0 then
    return;
  end if;
  deal_id := best_id;
  title := best_title;
  discount_cents := best_disc;
  return next;
end;
$$;
grant execute on function public.compute_bogo_discount(uuid, jsonb) to anon, authenticated;

-- Recreate create_order to also consider BOGO among the auto specials, picking
-- the larger of spend_threshold vs BOGO when no promo code is supplied.
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
    -- Best auto "spend & save" order discount…
    select ad.deal_id, ad.discount_cents
      into v_deal_id, discount
      from public.compute_auto_order_discount(p_dispensary_id, subtotal) ad;
    -- …vs best auto BOGO; keep whichever saves more.
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
    values (v_deal_id, new_id, uid, p_dispensary_id, coalesce(v_code, 'AUTO'), discount);
  end if;

  return new_id;
end;
$$;

grant execute on function public.create_order(uuid, public.order_type, jsonb, text, text)
  to authenticated;
