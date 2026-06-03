-- ════════════════════════════════════════════════════════════════════════════
-- 20260602000030_order_specials
-- Order-level auto-apply "spend & save" specials (kind = spend_threshold):
-- "spend $X, get Y% off the order". Applied automatically at checkout when no
-- promo code is entered (codes take precedence — no stacking unless extended).
-- Reward is a percentage of the post-item-sale subtotal, optionally capped by
-- max_discount_cents. Honors the date/day/time schedule like other specials.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create or replace function public.compute_auto_order_discount(
  p_dispensary_id uuid,
  p_subtotal_cents integer
)
returns table (deal_id uuid, title text, discount_cents integer)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  d record;
begin
  select dl.id, dl.title, dl.discount_value, dl.max_discount_cents
    into d
    from public.deals dl
    where dl.dispensary_id = p_dispensary_id
      and dl.kind = 'spend_threshold'
      and dl.auto_apply
      and dl.is_active
      and now() between dl.start_date and dl.end_date
      and (cardinality(dl.days_of_week) = 0
           or extract(dow from now())::smallint = any(dl.days_of_week))
      and (dl.time_start is null or dl.time_end is null
           or now()::time between dl.time_start and dl.time_end)
      and coalesce(dl.min_subtotal_cents, 0) <= p_subtotal_cents
    order by least(
      round(p_subtotal_cents * coalesce(dl.discount_value, 0) / 100.0)::int,
      coalesce(dl.max_discount_cents, 2147483647)
    ) desc
    limit 1;

  if not found then
    return;
  end if;

  deal_id := d.id;
  title := d.title;
  discount_cents := least(
    round(p_subtotal_cents * coalesce(d.discount_value, 0) / 100.0)::int,
    coalesce(d.max_discount_cents, p_subtotal_cents)
  );
  discount_cents := least(discount_cents, p_subtotal_cents);
  if discount_cents <= 0 then
    return;
  end if;
  return next;
end;
$$;
grant execute on function public.compute_auto_order_discount(uuid, integer) to anon, authenticated;

-- Recreate create_order to apply the auto order-discount when no promo code is
-- supplied. Everything else (item-sale pricing, commission) is unchanged.
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
    -- Customer-entered code takes precedence.
    select cd.deal_id, cd.discount_cents
      into v_deal_id, discount
      from public.compute_promo_discount(p_dispensary_id, p_promo_code, subtotal) cd;
    if v_deal_id is null then
      raise exception 'Invalid or expired promo code.' using errcode = '22023';
    end if;
    v_code := btrim(p_promo_code);
  else
    -- Otherwise apply the best auto "spend & save" order discount, if any.
    select ad.deal_id, ad.discount_cents
      into v_deal_id, discount
      from public.compute_auto_order_discount(p_dispensary_id, subtotal) ad;
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
