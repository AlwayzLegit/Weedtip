-- Follower "Updates": a dispensary owner broadcasts a time-boxed update to the
-- people who follow (favorite) their shop. Reuses favorites as the follow graph.
set search_path = public;

create table if not exists public.dispensary_updates (
  id uuid primary key default gen_random_uuid(),
  dispensary_id uuid not null references public.dispensaries(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 140),
  body text check (body is null or char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '6 weeks')
);
create index if not exists dispensary_updates_idx on public.dispensary_updates (dispensary_id, created_at desc);

alter table public.dispensary_updates enable row level security;

-- Live updates are public; owners/admins also see expired (past) ones.
create policy dispensary_updates_select on public.dispensary_updates
  for select using (
    expires_at > now() or public.owns_dispensary(dispensary_id) or public.is_admin()
  );
-- Only the owner/admin manages a shop's updates.
create policy dispensary_updates_write on public.dispensary_updates
  for all
  using (public.owns_dispensary(dispensary_id) or public.is_admin())
  with check (public.owns_dispensary(dispensary_id) or public.is_admin());

-- Post an update and fan it out to followers as notifications. SECURITY DEFINER:
-- verifies ownership, then writes notifications for OTHER users (which their own
-- RLS would forbid).
create or replace function public.post_dispensary_update(
  p_dispensary_id uuid, p_title text, p_body text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  d record;
  clean_title text := btrim(p_title);
  clean_body text := nullif(btrim(p_body), '');
begin
  if not public.owns_dispensary(p_dispensary_id) and not public.is_admin() then
    raise exception 'Only the dispensary owner can post updates' using errcode = '42501';
  end if;
  if clean_title is null or clean_title = '' then
    raise exception 'An update needs a title' using errcode = '22000';
  end if;
  select name, slug into d from public.dispensaries where id = p_dispensary_id;

  insert into public.dispensary_updates (dispensary_id, title, body)
    values (p_dispensary_id, left(clean_title, 140), clean_body)
    returning id into new_id;

  insert into public.notifications (user_id, type, title, body, data)
    select f.user_id, 'dispensary_update', d.name || ': ' || left(clean_title, 140), clean_body,
           jsonb_build_object('dispensary_slug', d.slug, 'dispensary_id', p_dispensary_id, 'update_id', new_id)
    from public.favorites f
    where f.dispensary_id = p_dispensary_id;

  return new_id;
end; $$;
revoke all on function public.post_dispensary_update(uuid, text, text) from public, anon;
grant execute on function public.post_dispensary_update(uuid, text, text) to authenticated;
