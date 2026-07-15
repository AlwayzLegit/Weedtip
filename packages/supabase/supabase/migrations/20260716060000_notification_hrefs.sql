-- ════════════════════════════════════════════════════════════════════════════
-- 20260716060000_notification_hrefs
-- Notifications from DB triggers stored no deep link in `data`, so the bell /
-- notifications list couldn't route to the relevant screen (and owners were sent
-- to the consumer order view). Embed an explicit `data.href` at insert time so
-- every future notification is navigable (web + mobile). Bodies copied from the
-- live definitions; only the `data` payload changes.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create or replace function public.notify_admins_new_claim()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text;
begin
  if tg_table_name = 'ownership_requests' then
    select name into v_name from public.dispensaries where id = new.dispensary_id;
    insert into public.notifications (user_id, type, title, body, data)
    select p.id, 'claim', 'New dispensary claim',
           coalesce(v_name, 'A listing') || ' has a new ownership claim to review.',
           jsonb_build_object('kind', 'dispensary', 'request_id', new.id,
                              'dispensary_id', new.dispensary_id, 'href', '/admin/claims')
    from public.profiles p where p.role = 'admin';
  else
    select name into v_name from public.brands where id = new.brand_id;
    insert into public.notifications (user_id, type, title, body, data)
    select p.id, 'claim', 'New brand claim',
           coalesce(v_name, 'A brand') || ' has a new ownership claim to review.',
           jsonb_build_object('kind', 'brand', 'claim_id', new.id,
                              'brand_id', new.brand_id, 'href', '/admin/brands')
    from public.profiles p where p.role = 'admin';
  end if;
  return new;
end; $function$;

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
        when 'completed' then 'Order completed'
        when 'cancelled' then 'Order cancelled'
        else 'Order updated'
      end,
      case new.status
        when 'confirmed' then 'Your order at ' || coalesce(shop_name, 'the dispensary') || ' was confirmed.'
        when 'ready' then 'Your order is ready for ' || new.order_type || '.'
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
