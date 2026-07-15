-- ════════════════════════════════════════════════════════════════════════════
-- 20260715150000_dispensary_taxes
--
-- Per-dispensary tax configuration (Weedmaps-style tax engine). Until now every
-- order used a single estimated per-state rate on operating_regions. Dispensaries
-- can now define their own taxes — name, rate, sales vs excise, adult/medical use
-- type — and the effective rate flows through both the checkout preview
-- (checkout_rules) and the authoritative total (create_order). When a shop has no
-- taxes configured, we still fall back to the state estimate, so nothing changes
-- for shops that haven't set theirs up.
--
-- v1 applies taxes at the order level (summed enabled rates); use_type and the
-- per-category columns are stored for a future per-line-item pass.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create table if not exists public.dispensary_taxes (
  id                   uuid primary key default extensions.gen_random_uuid(),
  dispensary_id        uuid not null references public.dispensaries (id) on delete cascade,
  name                 text not null,
  rate_bps             integer not null check (rate_bps >= 0 and rate_bps <= 10000),
  tax_type             text not null default 'sales' check (tax_type in ('sales', 'excise')),
  use_type             text not null default 'both' check (use_type in ('adult', 'medical', 'both')),
  apply_all_categories boolean not null default true,
  category_ids         uuid[] not null default '{}',
  enabled              boolean not null default true,
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint dispensary_taxes_name_len check (char_length(name) between 1 and 60)
);

create index if not exists dispensary_taxes_dispensary_idx
  on public.dispensary_taxes (dispensary_id);

create trigger dispensary_taxes_set_updated_at
  before update on public.dispensary_taxes
  for each row execute function public.set_updated_at();

alter table public.dispensary_taxes enable row level security;

-- Public read: the checkout preview + create_order (invoker) must see the rates.
drop policy if exists dispensary_taxes_select on public.dispensary_taxes;
create policy dispensary_taxes_select on public.dispensary_taxes
  for select to anon, authenticated using (true);

-- Only the dispensary's owner (or an admin) manages its taxes.
drop policy if exists dispensary_taxes_write on public.dispensary_taxes;
create policy dispensary_taxes_write on public.dispensary_taxes
  for all to authenticated
  using (
    exists (select 1 from public.dispensaries d
            where d.id = dispensary_id and d.owner_id = auth.uid())
    or public.is_admin()
  )
  with check (
    exists (select 1 from public.dispensaries d
            where d.id = dispensary_id and d.owner_id = auth.uid())
    or public.is_admin()
  );

-- Summed enabled tax rate in basis points, or NULL when the shop configured none
-- (so callers know to fall back to the state estimate). A configured 0% returns 0.
create or replace function public.dispensary_effective_tax_bps(p_dispensary_id uuid)
returns integer
language sql stable set search_path = public as $$
  select case when count(*) = 0 then null else coalesce(sum(rate_bps), 0)::int end
  from public.dispensary_taxes
  where dispensary_id = p_dispensary_id and enabled;
$$;
grant execute on function public.dispensary_effective_tax_bps(uuid) to anon, authenticated;

-- The rate a checkout should actually use: the shop's configured taxes if any,
-- else the state estimate, else 0.15.
create or replace function public.effective_tax_rate(p_dispensary_id uuid)
returns numeric
language sql stable set search_path = public as $$
  select coalesce(
    public.dispensary_effective_tax_bps(p_dispensary_id)::numeric / 10000,
    (select coalesce(r.tax_rate, 0.15)
       from public.dispensaries d
       left join public.operating_regions r on r.state = d.state
      where d.id = p_dispensary_id),
    0.15
  );
$$;
grant execute on function public.effective_tax_rate(uuid) to anon, authenticated;

-- checkout_rules now surfaces the effective (shop-or-state) rate.
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
    public.effective_tax_rate(d.id) as tax_rate,
    coalesce(r.is_recreational_legal, false),
    coalesce(r.is_medical_legal, false),
    (coalesce(r.is_medical_legal, false) and not coalesce(r.is_recreational_legal, false)) as medical_only,
    case
      when r.state is null then true
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

-- create_order: use the dispensary's effective tax rate. Body copied verbatim
-- from 20260714090000_monetization_integrity with one change — the tax_rate is
-- resolved via effective_tax_rate() instead of the raw region rate.
create or replace function public.create_order(
  p_dispensary_id uuid,
  p_order_type order_type,
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

  -- Shop-configured taxes take precedence over the state estimate.
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

-- create_pos_order: same effective-rate change for in-store receipts.
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

  -- Shop-configured taxes take precedence over the state estimate.
  tax_rate := public.effective_tax_rate(p_dispensary_id);

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
