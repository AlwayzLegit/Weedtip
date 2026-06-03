-- ════════════════════════════════════════════════════════════════════════════
-- 20260602000028_specials_engine
-- Wires the specials schema into an active discount engine for AUTO-APPLY,
-- item-level storefront sales (Weedmaps "Sale" mechanic). A single source of
-- truth — effective_unit_price() — is used by BOTH menu display and create_order,
-- so the price a shopper sees is exactly what they're charged.
--
-- Covered kinds: percentage, fixed_amount, price_target (per-item sales).
-- Targeting: whole menu / category / brand / specific products, with excludes.
-- Scheduling: date window + days-of-week + optional within-day time window.
-- Order-level kinds (bogo/bundle/gift/spend_threshold) and code stacking remain
-- on the existing promo-code path and are a later extension.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

-- price_target needs an explicit "drop the price to $X" value.
alter table public.deals add column if not exists target_price_cents integer;

-- ─── Single source of truth for a product's current price ────────────────────
-- Returns the best (lowest) active auto-apply sale price for a product, plus the
-- winning deal. When nothing applies, returns the list price with a null deal.
create or replace function public.effective_unit_price(p_product_id uuid)
returns table (unit_cents integer, deal_id uuid, deal_title text)
language sql
stable
security invoker
set search_path = public
as $$
  with prod as (
    select id, dispensary_id, category_id, brand_id, price_cents
    from public.products
    where id = p_product_id
  ),
  candidates as (
    select
      d.id as deal_id,
      d.title,
      case d.kind
        when 'percentage' then
          greatest(0, pr.price_cents - least(
            round(pr.price_cents * coalesce(d.discount_value, 0) / 100.0)::int,
            coalesce(d.max_discount_cents, 2147483647)))
        when 'fixed_amount' then
          greatest(0, pr.price_cents - least(
            round(coalesce(d.discount_value, 0) * 100)::int, pr.price_cents))
        when 'price_target' then
          least(pr.price_cents, coalesce(d.target_price_cents, pr.price_cents))
        else pr.price_cents
      end as cand_cents
    from public.deals d
    cross join prod pr
    where d.dispensary_id = pr.dispensary_id
      and d.is_active
      and d.auto_apply
      and d.kind in ('percentage', 'fixed_amount', 'price_target')
      and now() between d.start_date and d.end_date
      and (cardinality(d.days_of_week) = 0
           or extract(dow from now())::smallint = any(d.days_of_week))
      and (d.time_start is null or d.time_end is null
           or now()::time between d.time_start and d.time_end)
      and (
        d.target_scope = 'menu'
        or (d.target_scope = 'category' and pr.category_id = any(d.target_category_ids))
        or (d.target_scope = 'brand' and pr.brand_id is not null and pr.brand_id = any(d.target_brand_ids))
        or (d.target_scope = 'products' and pr.id = any(d.target_product_ids))
      )
      and not (pr.id = any(d.exclude_product_ids))
  ),
  best as (
    select c.deal_id, c.title, c.cand_cents
    from candidates c, prod
    where c.cand_cents < prod.price_cents   -- only real discounts win
    order by c.cand_cents asc
    limit 1
  )
  select
    coalesce((select cand_cents from best), (select price_cents from prod)) as unit_cents,
    (select deal_id from best) as deal_id,
    (select title from best) as deal_title;
$$;
grant execute on function public.effective_unit_price(uuid) to anon, authenticated;

-- ─── Batch helper for menu display ───────────────────────────────────────────
-- Only returns products that currently have a sale (sale_cents < list).
create or replace function public.dispensary_sale_prices(p_dispensary_id uuid)
returns table (product_id uuid, sale_cents integer, deal_id uuid, deal_title text)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, e.unit_cents, e.deal_id, e.deal_title
  from public.products p
  cross join lateral public.effective_unit_price(p.id) e
  where p.dispensary_id = p_dispensary_id
    and e.deal_id is not null
    and e.unit_cents < p.price_cents;
$$;
grant execute on function public.dispensary_sale_prices(uuid) to anon, authenticated;

-- ─── Re-create create_order to price each line at its effective sale price ────
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

    -- Server-authoritative price: applies any active auto-apply storefront sale.
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
    values (v_deal_id, new_id, uid, p_dispensary_id, btrim(p_promo_code), discount);
  end if;

  return new_id;
end;
$$;

grant execute on function public.create_order(uuid, public.order_type, jsonb, text, text)
  to authenticated;
