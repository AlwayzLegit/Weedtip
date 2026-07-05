-- ════════════════════════════════════════════════════════════════════════════
-- 20260704080000_market_rules
-- Audit findings #11/#12/#13: a flat 15% California tax was hardcoded into
-- create_order and create_pos_order (charged as real money in all 42 states),
-- and operating_regions legality gated nothing — shops in medical-only states
-- accepted orders with no notice or enforcement.
--
-- Fix: per-state tax_rate on operating_regions (estimated combined state
-- cannabis retail tax — excise plus state sales tax where it applies; admins
-- adjust in /admin/regions), one checkout_rules() lookup consumed by clients,
-- and legality enforcement inside create_order.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

alter table public.operating_regions
  add column if not exists tax_rate numeric(6,4) not null default 0.15
  check (tax_rate >= 0 and tax_rate <= 1);

-- Estimated combined state-level cannabis retail tax (excise + state sales tax
-- where charged at retail). These are documented approximations — several
-- states use potency- or weight-based excises that don't map cleanly to a flat
-- percentage — and are meant to be tuned by admins per market.
update public.operating_regions set tax_rate = v.rate::numeric
from (values
  ('AK', 0.0000), ('AL', 0.0900), ('AR', 0.1100), ('AZ', 0.2160),
  ('CA', 0.2225), ('CO', 0.1790), ('CT', 0.2000), ('DC', 0.0600),
  ('DE', 0.1500), ('FL', 0.0000), ('GA', 0.0700), ('HI', 0.0470),
  ('IA', 0.0600), ('ID', 0.0000), ('IL', 0.1875), ('IN', 0.0000),
  ('KS', 0.0000), ('KY', 0.0600), ('LA', 0.0450), ('MA', 0.1700),
  ('MD', 0.0900), ('ME', 0.1550), ('MI', 0.1600), ('MN', 0.1000),
  ('MO', 0.1000), ('MS', 0.0700), ('MT', 0.2000), ('NC', 0.0000),
  ('ND', 0.0500), ('NE', 0.0000), ('NH', 0.0000), ('NJ', 0.0663),
  ('NM', 0.1700), ('NV', 0.1685), ('NY', 0.1300), ('OH', 0.1575),
  ('OK', 0.1150), ('OR', 0.1700), ('PA', 0.0000), ('RI', 0.1700),
  ('SC', 0.0000), ('SD', 0.0450), ('TN', 0.0000), ('TX', 0.0000),
  ('UT', 0.0000), ('VA', 0.0600), ('VT', 0.2000), ('WA', 0.4365),
  ('WI', 0.0000), ('WV', 0.0600), ('WY', 0.0000)
) as v(state, rate)
where operating_regions.state = v.state;

-- One lookup for everything a checkout surface needs to know about a
-- dispensary's market: the tax rate to estimate with, whether the state is
-- medical-only, and whether online ordering is allowed at all. Both source
-- tables are publicly readable, so this is a plain invoker function.
create or replace function public.checkout_rules(p_dispensary_id uuid)
returns table (
  state char(2),
  tax_rate numeric,
  is_recreational_legal boolean,
  is_medical_legal boolean,
  medical_only boolean,
  can_order boolean,
  block_reason text
)
language sql stable set search_path to 'public' as $function$
  select
    d.state::char(2),
    coalesce(r.tax_rate, 0.15) as tax_rate,
    coalesce(r.is_recreational_legal, false),
    coalesce(r.is_medical_legal, false),
    (coalesce(r.is_medical_legal, false) and not coalesce(r.is_recreational_legal, false)) as medical_only,
    case
      when r.state is null then true  -- no region config: don't block
      when not r.is_medical_legal and not r.is_recreational_legal then false
      when r.is_medical_legal and not r.is_recreational_legal and not d.is_medical then false
      else true
    end as can_order,
    case
      when r.state is not null and not r.is_medical_legal and not r.is_recreational_legal
        then 'Cannabis sales are not legal in this state, so online ordering is unavailable.'
      when r.state is not null and r.is_medical_legal and not r.is_recreational_legal and not d.is_medical
        then 'This state licenses medical sales only, and this dispensary is not listed as a medical dispensary.'
      else null
    end as block_reason
  from public.dispensaries d
  left join public.operating_regions r on r.state = d.state
  where d.id = p_dispensary_id;
$function$;

grant execute on function public.checkout_rules(uuid) to anon, authenticated;

-- create_order: per-state tax + legality enforcement. Identical to the
-- 20260704020000 version except the marked MARKET RULES block and the
-- dispensary lookup it requires.
create or replace function public.create_order(
  p_dispensary_id uuid,
  p_order_type order_type,
  p_items jsonb,
  p_notes text default null,
  p_promo_code text default null,
  p_source text default 'web',
  p_device text default null
) returns uuid
language plpgsql set search_path to 'public' as $function$
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
  v_fee_bps integer;
  v_fee integer;
  tax integer;
  total integer;
  new_id uuid;
  qty integer;
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

  -- MARKET RULES: state tax rate + legality (audit #11/#13).
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

  v_fee_bps := coalesce(
    (select pl.commission_bps
       from public.dispensary_subscriptions ds
       join public.plans pl on pl.id = ds.plan_id
       where ds.dispensary_id = p_dispensary_id and ds.status = 'active'
       limit 1),
    500);
  v_fee := round(discounted * v_fee_bps / 10000.0);

  perform set_config('app.orders_trusted', '1', true);

  insert into public.orders (
    user_id, dispensary_id, status, order_type, items,
    subtotal_cents, discount_cents, tax_cents, total_cents, deal_id, notes,
    platform_fee_cents, platform_fee_bps, source, device
  )
  values (
    uid, p_dispensary_id, 'pending', p_order_type, snapshot,
    subtotal, coalesce(discount, 0), tax, total, v_deal_id, p_notes,
    v_fee, v_fee_bps, v_source, v_device
  )
  returning id into new_id;

  if v_deal_id is not null and discount > 0 then
    insert into public.deal_redemptions (deal_id, order_id, user_id, dispensary_id, code, discount_cents)
    values (v_deal_id, new_id, uid, p_dispensary_id, coalesce(v_code, 'AUTO'), discount);
  end if;

  return new_id;
end;
$function$;

-- create_pos_order: same per-state rate on in-store receipts (audit #12).
-- Legality is not re-checked here — POS rings an in-person sale at a
-- state-licensed storefront; the license itself is the authority.
create or replace function public.create_pos_order(
  p_dispensary_id uuid,
  p_items jsonb,
  p_payment_method text default 'cash'
) returns uuid
language plpgsql set search_path to 'public' as $function$
declare
  uid uuid := auth.uid();
  tax_rate numeric := 0.15;
  line jsonb;
  prod record;
  v_unit integer;
  snapshot jsonb := '[]'::jsonb;
  subtotal integer := 0;
  tax integer;
  total integer;
  new_id uuid;
  qty integer;
  v_method text := case when p_payment_method in ('cash', 'card', 'debit') then p_payment_method else 'cash' end;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if not public.owns_dispensary(p_dispensary_id) and not public.is_admin() then
    raise exception 'Only the dispensary owner can ring up sales' using errcode = '42501';
  end if;
  if not public.is_admin()
     and not (select pos_addon from public.dispensaries where id = p_dispensary_id) then
    raise exception 'The POS add-on is not enabled for this dispensary' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'The ticket is empty.' using errcode = '22023';
  end if;

  -- MARKET RULES: the shop's own state rate, not California's.
  select r.tax_rate into tax_rate
  from public.operating_regions r
  join public.dispensaries d on d.state = r.state
  where d.id = p_dispensary_id;
  tax_rate := coalesce(tax_rate, 0.15);

  for line in select value from jsonb_array_elements(p_items) loop
    qty := coalesce((line ->> 'quantity')::int, 0);
    if qty <= 0 or qty > 99 then
      raise exception 'Invalid quantity.' using errcode = '22023';
    end if;

    select id, name, stock_qty
      into prod
      from public.products
      where id = (line ->> 'product_id')::uuid
        and dispensary_id = p_dispensary_id;
    if not found then
      raise exception 'A product on the ticket is not in this menu.' using errcode = '22023';
    end if;
    if prod.stock_qty is not null and prod.stock_qty < qty then
      raise exception 'Not enough stock for "%".', prod.name using errcode = '22023';
    end if;

    select unit_cents into v_unit from public.effective_unit_price(prod.id);
    subtotal := subtotal + v_unit * qty;
    snapshot := snapshot || jsonb_build_object(
      'product_id', prod.id, 'name', prod.name, 'quantity', qty, 'unit_price_cents', v_unit
    );
  end loop;

  tax := round(subtotal * tax_rate);
  total := subtotal + tax;

  perform set_config('app.orders_trusted', '1', true);

  insert into public.orders (
    user_id, dispensary_id, status, order_type, items,
    subtotal_cents, discount_cents, tax_cents, total_cents, notes,
    platform_fee_cents, platform_fee_bps, source, device,
    payment_status, payment_method, paid_at
  )
  values (
    uid, p_dispensary_id, 'completed', 'pickup', snapshot,
    subtotal, 0, tax, total, 'In-store POS sale',
    0, 0, 'pos', null,
    'paid', v_method, now()
  )
  returning id into new_id;

  for line in select value from jsonb_array_elements(p_items) loop
    qty := coalesce((line ->> 'quantity')::int, 0);
    update public.products
      set stock_qty = greatest(0, stock_qty - qty),
          in_stock = (stock_qty - qty) > 0
      where id = (line ->> 'product_id')::uuid
        and dispensary_id = p_dispensary_id
        and stock_qty is not null;
  end loop;

  return new_id;
end;
$function$;
