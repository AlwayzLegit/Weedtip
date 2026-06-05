-- Self-serve POS billing: let the Stripe webhook (service_role) flip pos_addon
-- without being an admin user, via a per-transaction bypass flag — mirrors the
-- app.sync_featured pattern used for the featured flag.
set search_path = public;

create or replace function public.enforce_dispensary_admin_fields()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if (new.status is distinct from old.status
      or new.featured_manual is distinct from old.featured_manual)
     and not public.is_admin() then
    raise exception 'Only an admin can change dispensary status or featured flag'
      using errcode = 'check_violation';
  end if;

  if (new.pos_addon is distinct from old.pos_addon)
     and not public.is_admin()
     and coalesce(current_setting('app.pos_grant', true), '') <> 'on' then
    raise exception 'Only an admin can change the POS add-on flag'
      using errcode = 'check_violation';
  end if;

  if (new.featured is distinct from old.featured)
     and not public.is_admin()
     and coalesce(current_setting('app.sync_featured', true), '') <> 'on' then
    raise exception 'Only an admin can change dispensary status or featured flag'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Webhook-only entitlement setter (service_role).
create or replace function public.grant_pos_addon(p_dispensary_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.pos_grant', 'on', true);
  update public.dispensaries set pos_addon = p_enabled where id = p_dispensary_id;
end;
$$;
revoke all on function public.grant_pos_addon(uuid, boolean) from public, anon, authenticated;
grant execute on function public.grant_pos_addon(uuid, boolean) to service_role;
