-- POS as a paid add-on: an admin-granted entitlement flag on the dispensary.
-- The register page and create_pos_order both gate on it; owners can't self-grant
-- (the field is admin-guarded like status/featured).
set search_path = public;

alter table public.dispensaries add column if not exists pos_addon boolean not null default false;

create or replace function public.enforce_dispensary_admin_fields()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  -- Admin-intent fields: only admins may change them.
  if (new.status is distinct from old.status
      or new.featured_manual is distinct from old.featured_manual
      or new.pos_addon is distinct from old.pos_addon)
     and not public.is_admin() then
    raise exception 'Only an admin can change dispensary status, featured, or add-on flags'
      using errcode = 'check_violation';
  end if;

  -- Derived featured flag: admins, or the featured-sync routine, may change it.
  if (new.featured is distinct from old.featured)
     and not public.is_admin()
     and coalesce(current_setting('app.sync_featured', true), '') <> 'on' then
    raise exception 'Only an admin can change dispensary status or featured flag'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Gate the POS sale RPC on the entitlement (admins bypass).
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
