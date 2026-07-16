-- ════════════════════════════════════════════════════════════════════════════
-- 20260716230000_handle_new_user_oauth_names
--
-- OAuth providers put the user's name in `full_name` / `name` metadata keys,
-- not the `display_name` our email sign-up form sends — so Google sign-ups
-- landed with a NULL display name. Coalesce across all three.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  meta_role text := new.raw_user_meta_data ->> 'role';
  requested_role public.user_role := 'consumer';
  dob date := null;
begin
  if meta_role in ('consumer', 'dispensary_owner') then
    requested_role := meta_role::public.user_role;
  end if;

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
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    dob
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;
