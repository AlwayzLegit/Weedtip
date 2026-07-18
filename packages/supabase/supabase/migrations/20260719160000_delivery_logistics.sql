-- ════════════════════════════════════════════════════════════════════════════
-- 20260719160000_delivery_logistics
-- Delivery logistics v1 (part 2/2): drivers, assignment, ready-ETA, notify copy.
--
-- dispensary_drivers is a lightweight per-shop roster (name + phone, no user
-- accounts — drivers don't log in yet). Orders gain driver_id + a ready/delivery
-- ETA in minutes that surfaces to the customer. The order notification trigger
-- learns the out_for_delivery copy. Live driver GPS is deferred until a driver
-- client exists to feed locations.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create table if not exists public.dispensary_drivers (
  id            uuid primary key default extensions.gen_random_uuid(),
  dispensary_id uuid not null references public.dispensaries (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  phone         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists dispensary_drivers_dispensary_idx
  on public.dispensary_drivers (dispensary_id) where is_active;

alter table public.dispensary_drivers enable row level security;

-- Shop team with the 'orders' capability (owner + manager) manages the roster.
drop policy if exists dispensary_drivers_select on public.dispensary_drivers;
create policy dispensary_drivers_select on public.dispensary_drivers
  for select to authenticated
  using (public.owns_dispensary(dispensary_id) or public.is_admin());

drop policy if exists dispensary_drivers_insert on public.dispensary_drivers;
create policy dispensary_drivers_insert on public.dispensary_drivers
  for insert to authenticated
  with check (public.member_can(dispensary_id, 'orders') or public.is_admin());

drop policy if exists dispensary_drivers_update on public.dispensary_drivers;
create policy dispensary_drivers_update on public.dispensary_drivers
  for update to authenticated
  using (public.member_can(dispensary_id, 'orders') or public.is_admin())
  with check (public.member_can(dispensary_id, 'orders') or public.is_admin());

drop policy if exists dispensary_drivers_delete on public.dispensary_drivers;
create policy dispensary_drivers_delete on public.dispensary_drivers
  for delete to authenticated
  using (public.member_can(dispensary_id, 'orders') or public.is_admin());

alter table public.orders
  add column if not exists driver_id uuid references public.dispensary_drivers (id) on delete set null,
  add column if not exists ready_eta_minutes integer
    check (ready_eta_minutes is null or ready_eta_minutes between 1 and 480);

create or replace function public.notify_order_event()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  shop_name text;
  owner uuid;
begin
  select name, owner_id into shop_name, owner
  from public.dispensaries where id = new.dispensary_id;

  if tg_op = 'INSERT' then
    if owner is not null then
      insert into public.notifications (user_id, type, title, body, data)
      values (owner, 'order_new', 'New order received',
              'You have a new ' || new.order_type || ' order.',
              jsonb_build_object('order_id', new.id, 'status', new.status,
                                 'href', '/dashboard/orders/' || new.id));
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      new.user_id, 'order_update',
      case new.status
        when 'confirmed' then 'Order confirmed'
        when 'ready' then 'Order ready'
        when 'out_for_delivery' then 'Out for delivery'
        when 'completed' then 'Order completed'
        when 'cancelled' then 'Order cancelled'
        else 'Order updated'
      end,
      case new.status
        when 'confirmed' then 'Your order at ' || coalesce(shop_name, 'the dispensary') || ' was confirmed.'
        when 'ready' then 'Your order is ready for ' || new.order_type || '.'
        when 'out_for_delivery' then 'Your order from ' || coalesce(shop_name, 'the dispensary') || ' is on its way.'
        when 'completed' then 'Your order is complete. Enjoy!'
        when 'cancelled' then 'Your order was cancelled.'
        else 'Your order status changed to ' || new.status || '.'
      end,
      jsonb_build_object('order_id', new.id, 'status', new.status,
                         'href', '/orders/' || new.id)
    );
  end if;
  return new;
end;
$function$;

-- A customer may see the driver assigned to THEIR order (name/phone on the
-- order page — standard delivery safety UX). Everyone else: shop team only.
drop policy if exists dispensary_drivers_select on public.dispensary_drivers;
create policy dispensary_drivers_select on public.dispensary_drivers
  for select to authenticated
  using (
    public.owns_dispensary(dispensary_id)
    or public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.driver_id = dispensary_drivers.id and o.user_id = auth.uid()
    )
  );
