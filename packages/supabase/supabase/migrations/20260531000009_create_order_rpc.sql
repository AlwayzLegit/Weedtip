-- ════════════════════════════════════════════════════════════════════════════
-- 20260531000009_create_order_rpc
-- Server-authoritative order creation as a Postgres RPC so WEB and MOBILE share
-- one contract. The client sends only {product_id, quantity}; prices, names, the
-- line-item snapshot, and totals are derived here from the products table — a
-- tampered cart can never set its own prices.
--
-- SECURITY INVOKER: runs as the caller, so RLS enforces everything —
--   • products read: products_select_public requires an ACTIVE dispensary
--   • orders insert: orders_insert_self requires user_id = auth.uid() + active shop
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create or replace function public.create_order(
  p_dispensary_id uuid,
  p_order_type public.order_type,
  p_items jsonb,            -- [{ "product_id": uuid, "quantity": int }, ...]
  p_notes text default null
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

  tax := round(subtotal * tax_rate);
  total := subtotal + tax;

  insert into public.orders (
    user_id, dispensary_id, status, order_type, items,
    subtotal_cents, tax_cents, total_cents, notes
  )
  values (
    uid, p_dispensary_id, 'pending', p_order_type, snapshot,
    subtotal, tax, total, p_notes
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.create_order(uuid, public.order_type, jsonb, text)
  to authenticated;
