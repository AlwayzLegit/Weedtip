-- ════════════════════════════════════════════════════════════════════════════
-- 20260530000004_functions_and_triggers
-- Shared utility functions, the auth → profile bootstrap, RLS helper predicates,
-- and integrity-guard triggers. SECURITY DEFINER functions pin search_path to ''
-- and fully-qualify every identifier (prevents search_path hijacking).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── updated_at maintenance ──────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Auth → profile bootstrap ────────────────────────────────────────────────
-- Auto-create a profile row when a new auth user is created. Role and display_name
-- can be passed via signup metadata; role is clamped to 'consumer' or
-- 'dispensary_owner' so signup can never mint an admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta_role text := new.raw_user_meta_data ->> 'role';
  requested_role public.user_role := 'consumer';
  dob date := null;
begin
  -- Only honor a self-serviceable role; anything else (incl. 'admin' or garbage)
  -- falls back to 'consumer'. Signup can never mint an admin.
  if meta_role in ('consumer', 'dispensary_owner') then
    requested_role := meta_role::public.user_role;
  end if;

  -- Tolerate a malformed date_of_birth rather than failing the whole signup.
  begin
    dob := nullif(new.raw_user_meta_data ->> 'date_of_birth', '')::date;
  exception
    when others then
      dob := null;
  end;

  insert into public.profiles (id, role, display_name, date_of_birth)
  values (
    new.id,
    requested_role,
    new.raw_user_meta_data ->> 'display_name',
    dob
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ─── RLS helper predicates ───────────────────────────────────────────────────
-- SECURITY DEFINER so they read base tables without tripping the very RLS policies
-- they support (avoids recursive policy evaluation on `profiles`).

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.owns_dispensary(target_dispensary_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.dispensaries
    where id = target_dispensary_id and owner_id = auth.uid()
  );
$$;

-- ─── Integrity guards ────────────────────────────────────────────────────────
-- Block self role escalation: only an admin may change a profile's role.
create or replace function public.enforce_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an admin can change a profile role'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_enforce_role
  before update on public.profiles
  for each row
  execute function public.enforce_profile_role();

-- Marketplace-controlled dispensary fields (status, featured) may only be changed
-- by an admin. Owners can edit everything else about their own listing.
create or replace function public.enforce_dispensary_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.status is distinct from old.status or new.featured is distinct from old.featured)
     and not public.is_admin() then
    raise exception 'Only an admin can change dispensary status or featured flag'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger dispensaries_enforce_admin_fields
  before update on public.dispensaries
  for each row
  execute function public.enforce_dispensary_admin_fields();

-- ─── Attach updated_at triggers ──────────────────────────────────────────────
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger dispensaries_set_updated_at
  before update on public.dispensaries
  for each row execute function public.set_updated_at();

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger deals_set_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create trigger operating_regions_set_updated_at
  before update on public.operating_regions
  for each row execute function public.set_updated_at();
