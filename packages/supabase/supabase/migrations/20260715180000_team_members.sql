-- ════════════════════════════════════════════════════════════════════════════
-- 20260715180000_team_members
--
-- Team & roles for dispensaries. The single owner (dispensaries.owner_id) can
-- invite teammates by email as managers or staff. Access is delegated by
-- extending owns_dispensary() — the one helper 25+ RLS policies already use — so
-- active members get the same CONTENT access (menu, deals, orders, etc.) as the
-- owner without touching every policy. Money (plan/billing) and team management
-- stay owner-only, enforced in the app actions.
--
-- Invite → accept: an invite is stored by email (pending). When the invitee is
-- signed in with that email they accept via accept_dispensary_invite(), which
-- links their user_id and flips the row active (a SECURITY DEFINER RPC so they
-- can't self-escalate their role).
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create table if not exists public.dispensary_members (
  id            uuid primary key default extensions.gen_random_uuid(),
  dispensary_id uuid not null references public.dispensaries (id) on delete cascade,
  user_id       uuid references public.profiles (id) on delete cascade,
  email         text not null,
  role          text not null default 'staff' check (role in ('manager', 'staff')),
  status        text not null default 'pending' check (status in ('pending', 'active')),
  invited_by    uuid references public.profiles (id),
  accepted_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (dispensary_id, email)
);

create index if not exists dispensary_members_dispensary_idx
  on public.dispensary_members (dispensary_id);
create index if not exists dispensary_members_user_idx
  on public.dispensary_members (user_id) where user_id is not null;

alter table public.dispensary_members enable row level security;

-- Visible to: the shop owner, admins, and the invitee (by linked user or email).
drop policy if exists members_select on public.dispensary_members;
create policy members_select on public.dispensary_members
  for select to authenticated
  using (
    (select owner_id from public.dispensaries d where d.id = dispensary_id) = auth.uid()
    or user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or public.is_admin()
  );

-- Only the owner (or an admin) invites/edits/removes members.
drop policy if exists members_write on public.dispensary_members;
create policy members_write on public.dispensary_members
  for all to authenticated
  using (
    (select owner_id from public.dispensaries d where d.id = dispensary_id) = auth.uid()
    or public.is_admin()
  )
  with check (
    (select owner_id from public.dispensaries d where d.id = dispensary_id) = auth.uid()
    or public.is_admin()
  );

-- Extend the access helper: active members count as "owning" for content RLS.
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
  ) or exists (
    select 1 from public.dispensary_members m
    where m.dispensary_id = target_dispensary_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

-- Let members read/update the dispensary row itself (view pending, edit the
-- listing) — the enforce_dispensary_admin_fields trigger still blocks
-- status/featured/pos changes by non-admins. Delete + insert stay owner-only.
drop policy if exists dispensaries_select_owner_or_admin on public.dispensaries;
create policy dispensaries_select_owner_or_admin on public.dispensaries
  for select to authenticated
  using (public.owns_dispensary(id) or public.is_admin());

drop policy if exists dispensaries_update_owner_or_admin on public.dispensaries;
create policy dispensaries_update_owner_or_admin on public.dispensaries
  for update to authenticated
  using (public.owns_dispensary(id) or public.is_admin())
  with check (public.owns_dispensary(id) or public.is_admin());

-- Invitee accepts: links their account + activates. SECURITY DEFINER so they
-- can only accept an invite addressed to their email; role is left untouched.
create or replace function public.accept_dispensary_invite(p_member_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_updated int;
begin
  if auth.uid() is null or v_email = '' then
    return false;
  end if;
  update public.dispensary_members
    set user_id = auth.uid(), status = 'active', accepted_at = now()
    where id = p_member_id and status = 'pending' and lower(email) = v_email;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;
revoke all on function public.accept_dispensary_invite(uuid) from public, anon;
grant execute on function public.accept_dispensary_invite(uuid) to authenticated;
