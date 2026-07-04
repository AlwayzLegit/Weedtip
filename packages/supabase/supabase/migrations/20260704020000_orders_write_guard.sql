-- ════════════════════════════════════════════════════════════════════════════
-- 20260704020000_orders_write_guard
-- SECURITY (audit finding #10): `authenticated` holds table-level INSERT/UPDATE
-- on public.orders and the RLS policies only check party membership — so a
-- buyer could PATCH their own order to paid/completed, zero the totals, forge a
-- "verified shopper" review (reviews_set_verified keys on status/payment_status),
-- or POST a fabricated order via PostgREST. This adds a column-level write guard:
--
--   • INSERT: rejected unless it comes from a trusted server path. The two
--     legitimate insert RPCs (create_order, create_pos_order) set a txn-local
--     flag `app.orders_trusted`; direct PostgREST inserts have no flag → blocked.
--   • UPDATE: money/attribution/identity columns are immutable to non-trusted
--     writers; buyers may only cancel (status→cancelled) and set notes /
--     payment_method (the free-commit "pay at dispensary" step). Owners/admins
--     may additionally advance status and mark payment (counter operations).
--   • service_role (Stripe webhooks etc.) and the flag bypass entirely.
--
-- RLS still applies on top (defense in depth). Also adds fulfillment validation
-- to create_order (audit medium: order_type was never checked against
-- is_delivery/is_pickup). Function bodies are reproduced verbatim from the live
-- definitions plus the two additions, so no other behavior changes.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create or replace function public.orders_write_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  is_buyer boolean;
begin
  -- Trusted server paths: the insert RPCs set app.orders_trusted; Stripe
  -- webhooks and admin tooling connect as service_role. These bypass the guard.
  if current_user = 'service_role'
     or coalesce(current_setting('app.orders_trusted', true), '') = '1' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Orders must be placed through checkout.' using errcode = '42501';
  end if;

  -- UPDATE: financial, attribution, and identity columns are server-authoritative
  -- and never client-writable, regardless of role.
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
  or new.stripe_session_id is distinct from old.stripe_session_id
  or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
  or new.created_at       is distinct from old.created_at then
    raise exception 'Order financials cannot be modified.' using errcode = '42501';
  end if;

  is_buyer := old.user_id = uid
              and not public.owns_dispensary(old.dispensary_id)
              and not public.is_admin();

  if is_buyer then
    -- Buyers may only cancel a not-yet-fulfilled order; they cannot self-mark
    -- payment/fulfillment (which would forge a verified-shopper review) or
    -- reassign staff.
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
$function$;

drop trigger if exists orders_write_guard on public.orders;
create trigger orders_write_guard
  before insert or update on public.orders
  for each row execute function public.orders_write_guard();

-- ── create_order: set the trusted flag + validate fulfillment mode ────────────
-- (verbatim from the live definition; only the two marked blocks are new)
create or replace function public.create_order(
  p_dispensary_id uuid,
  p_order_type public.order_type,
  p_items jsonb,
  p_notes text default null,
  p_promo_code text default null,
  p_source text default 'web',
  p_device text default null
)
returns uuid
language plpgsql
set search_path to 'public'
as $function$
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
  v_source text := case when p_source in ('web', 'embed', 'mobile_web') then p_source else 'web' end;
  v_device text := case when p_device in ('desktop', 'mobile', 'tablet') then p_device else null end;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.' using errcode = '22023';
  end if;

  -- NEW: fulfillment mode must be one the dispensary actually offers.
  if not exists (
    select 1 from public.dispensaries d
    where d.id = p_dispensary_id
      and ((p_order_type = 'delivery' and d.is_delivery)
        or (p_order_type = 'pickup'   and d.is_pickup))
  ) then
    raise exception 'This dispensary does not offer % orders.', p_order_type using errcode = '22023';
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

  -- NEW: mark this insert as coming from the trusted checkout path.
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

-- ── create_pos_order: set the trusted flag (verbatim otherwise) ───────────────
create or replace function public.create_pos_order(
  p_dispensary_id uuid,
  p_items jsonb,
  p_payment_method text default 'cash'
)
returns uuid
language plpgsql
set search_path to 'public'
as $function$
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

  -- NEW: mark this insert as coming from the trusted POS path.
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
