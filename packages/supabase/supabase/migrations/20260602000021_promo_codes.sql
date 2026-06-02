-- ════════════════════════════════════════════════════════════════════════════
-- 20260602000021_promo_codes
-- Trackable promo codes tied to deals (Weedmaps-style). A deal can carry an
-- optional code; customers enter it at checkout, where create_order validates it
-- server-side, applies the discount to the authoritative total, and records a
-- redemption row so owners can see how often each code is used.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

-- 1. Promo code on deals (case-insensitive unique per dispensary).
alter table public.deals add column code text;
create unique index deals_dispensary_code_uniq
  on public.deals (dispensary_id, lower(code))
  where code is not null;

-- 2. Discount attribution on orders.
alter table public.orders add column discount_cents integer not null default 0;
alter table public.orders
  add column deal_id uuid references public.deals(id) on delete set null;

-- 3. Redemption ledger (one row per order that used a code).
create table public.deal_redemptions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  dispensary_id uuid not null references public.dispensaries(id) on delete cascade,
  code text not null,
  discount_cents integer not null,
  created_at timestamptz not null default now(),
  unique (order_id)
);
create index deal_redemptions_deal_idx on public.deal_redemptions (deal_id);
create index deal_redemptions_dispensary_idx on public.deal_redemptions (dispensary_id);

alter table public.deal_redemptions enable row level security;

-- Customers create their own redemption rows (only through create_order).
create policy deal_redemptions_insert_self on public.deal_redemptions
  for insert to authenticated
  with check (user_id = auth.uid());

-- Owners (and admins) read redemptions for their shop; customers read their own.
create policy deal_redemptions_select on public.deal_redemptions
  for select to authenticated
  using (public.owns_dispensary(dispensary_id) or public.is_admin() or user_id = auth.uid());

-- 4. Single source of truth for the discount a code yields on a subtotal.
--    Returns zero rows when the code is missing/invalid/expired.
create or replace function public.compute_promo_discount(
  p_dispensary_id uuid,
  p_code text,
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

  deal_id := d.id;
  title := d.title;
  if d.discount_type = 'percentage' then
    discount_cents := least(round(p_subtotal_cents * d.discount_value / 100.0)::int, p_subtotal_cents);
  elsif d.discount_type = 'fixed' then
    discount_cents := least((d.discount_value * 100)::int, p_subtotal_cents);
  else
    discount_cents := 0; -- BOGO isn't expressible as a flat code discount
  end if;

  return next;
end;
$$;

grant execute on function public.compute_promo_discount(uuid, text, integer) to authenticated, anon;

-- 5. Re-create create_order with an optional promo code. Drop the old 4-arg
--    version first (adding a parameter changes the signature).
drop function if exists public.create_order(uuid, public.order_type, jsonb, text);

create or replace function public.create_order(
  p_dispensary_id uuid,
  p_order_type public.order_type,
  p_items jsonb,            -- [{ "product_id": uuid, "quantity": int }, ...]
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

  insert into public.orders (
    user_id, dispensary_id, status, order_type, items,
    subtotal_cents, discount_cents, tax_cents, total_cents, deal_id, notes
  )
  values (
    uid, p_dispensary_id, 'pending', p_order_type, snapshot,
    subtotal, coalesce(discount, 0), tax, total, v_deal_id, p_notes
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
