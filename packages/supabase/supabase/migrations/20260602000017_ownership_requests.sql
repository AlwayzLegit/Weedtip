-- ════════════════════════════════════════════════════════════════════════════
-- 20260602000017_ownership_requests
-- Lets a dispensary_owner request to claim an unclaimed, active directory listing
-- (seeded shops start with owner_id = NULL). Admins approve/reject via
-- SECURITY DEFINER RPCs that attach owner_id atomically and auto-reject competitors.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create table public.ownership_requests (
  id             uuid primary key default extensions.gen_random_uuid(),
  dispensary_id  uuid not null references public.dispensaries (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  status         text not null default 'pending',
  message        text,
  license_number text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint ownership_requests_status_chk check (status in ('pending', 'approved', 'rejected')),
  constraint ownership_requests_msg_len check (message is null or char_length(message) <= 2000),
  constraint ownership_requests_unique unique (dispensary_id, user_id)
);

create index ownership_requests_dispensary_idx on public.ownership_requests (dispensary_id);
create index ownership_requests_user_idx on public.ownership_requests (user_id);
create index ownership_requests_status_idx on public.ownership_requests (status);

create trigger ownership_requests_set_updated_at
  before update on public.ownership_requests
  for each row execute function public.set_updated_at();

alter table public.ownership_requests enable row level security;

-- Requester sees their own; admins see all.
create policy ownership_requests_select on public.ownership_requests
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- A dispensary_owner may request to claim an UNCLAIMED, ACTIVE listing, as themselves.
create policy ownership_requests_insert on public.ownership_requests
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.auth_role() = 'dispensary_owner'
    and exists (
      select 1 from public.dispensaries d
      where d.id = ownership_requests.dispensary_id
        and d.owner_id is null
        and d.status = 'active'
    )
  );

-- Requester may withdraw their own not-yet-approved request; admins may delete any.
create policy ownership_requests_delete on public.ownership_requests
  for delete to authenticated
  using ((user_id = auth.uid() and status <> 'approved') or public.is_admin());

-- Status changes go through the SECURITY DEFINER RPCs below (no direct UPDATE policy).

create or replace function public.approve_ownership_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can approve ownership requests' using errcode = '42501';
  end if;
  select * into r from public.ownership_requests where id = p_request_id;
  if not found then
    raise exception 'Ownership request not found' using errcode = 'P0002';
  end if;
  if r.status <> 'pending' then
    raise exception 'Request is not pending' using errcode = '22023';
  end if;
  update public.dispensaries set owner_id = r.user_id where id = r.dispensary_id;
  update public.ownership_requests set status = 'approved' where id = p_request_id;
  update public.ownership_requests
    set status = 'rejected'
    where dispensary_id = r.dispensary_id and id <> p_request_id and status = 'pending';
end;
$$;

create or replace function public.reject_ownership_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can reject ownership requests' using errcode = '42501';
  end if;
  update public.ownership_requests set status = 'rejected'
  where id = p_request_id and status = 'pending';
end;
$$;

revoke all on function public.approve_ownership_request(uuid) from public, anon;
revoke all on function public.reject_ownership_request(uuid) from public, anon;
grant execute on function public.approve_ownership_request(uuid) to authenticated;
grant execute on function public.reject_ownership_request(uuid) to authenticated;
