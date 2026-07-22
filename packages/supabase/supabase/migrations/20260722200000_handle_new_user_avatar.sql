-- ════════════════════════════════════════════════════════════════════════════
-- 20260722200000_handle_new_user_avatar
--
-- OAuth providers hand us the user's profile picture in the `avatar_url` /
-- `picture` metadata keys, but handle_new_user only copied the name — so Google
-- sign-ups landed with a display name but a NULL avatar. Coalesce the avatar in
-- alongside the name, and backfill any existing OAuth users that predate this.
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

  insert into public.profiles (id, role, display_name, avatar_url, date_of_birth)
  values (
    new.id,
    requested_role,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    ),
    dob
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

-- Backfill: OAuth users created before this migration have a NULL profile
-- avatar even though the provider metadata carries one. Fill it in.
update public.profiles p
set avatar_url = coalesce(
  u.raw_user_meta_data ->> 'avatar_url',
  u.raw_user_meta_data ->> 'picture'
)
from auth.users u
where u.id = p.id
  and p.avatar_url is null
  and coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture') is not null;
