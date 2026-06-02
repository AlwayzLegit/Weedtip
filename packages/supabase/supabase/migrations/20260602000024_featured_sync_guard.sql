-- ════════════════════════════════════════════════════════════════════════════
-- 20260602000024_featured_sync_guard
-- Makes the derived `featured` flag writable by sync_featured_flags (including the
-- pg_cron job, which has no admin auth context) without opening a hole:
--   • featured_manual (admin intent) is now guarded admin-only, like status.
--   • featured (derived) may change only when an admin acts OR the sync function
--     sets a transaction-local flag, so owners still can't self-feature.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create or replace function public.enforce_dispensary_admin_fields()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  -- Admin-intent fields: only admins may change them.
  if (new.status is distinct from old.status
      or new.featured_manual is distinct from old.featured_manual)
     and not public.is_admin() then
    raise exception 'Only an admin can change dispensary status or featured flag'
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

create or replace function public.sync_featured_flags(p_dispensary_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Authorize the derived-flag write for this transaction only.
  perform set_config('app.sync_featured', 'on', true);

  update public.dispensaries d
  set featured = d.featured_manual or exists (
    select 1 from public.placements p
    where p.dispensary_id = d.id
      and p.type = 'featured'
      and p.is_active
      and p.starts_at <= now()
      and (p.ends_at is null or p.ends_at >= now())
  )
  where p_dispensary_id is null or d.id = p_dispensary_id;
end;
$$;
