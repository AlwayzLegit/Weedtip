-- Follower (favorite) count for a shop, visible to its owner/admin without
-- exposing who the followers are (favorites RLS hides other users' rows).
set search_path = public;

create or replace function public.dispensary_follower_count(p_dispensary_id uuid)
returns integer language sql security definer set search_path = public as $$
  select case
    when public.owns_dispensary(p_dispensary_id) or public.is_admin()
    then (select count(*)::int from public.favorites where dispensary_id = p_dispensary_id)
    else 0
  end;
$$;
revoke all on function public.dispensary_follower_count(uuid) from public, anon;
grant execute on function public.dispensary_follower_count(uuid) to authenticated;
