-- POS staff with hashed PINs (pgcrypto). Operators sign in at the register with a
-- PIN; sales are tagged with the staff member who rang them.
set search_path = public, extensions;

create table if not exists public.pos_staff (
  id uuid primary key default gen_random_uuid(),
  dispensary_id uuid not null references public.dispensaries(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  pin_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists pos_staff_disp_idx on public.pos_staff (dispensary_id);

alter table public.orders add column if not exists sold_by_staff uuid references public.pos_staff(id);

alter table public.pos_staff enable row level security;
create policy pos_staff_all on public.pos_staff
  for all
  using (public.owns_dispensary(dispensary_id) or public.is_admin())
  with check (public.owns_dispensary(dispensary_id) or public.is_admin());

-- Add a staff member (hashes the PIN). Owner/admin only.
create or replace function public.add_pos_staff(p_dispensary_id uuid, p_name text, p_pin text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare nid uuid;
begin
  if not public.owns_dispensary(p_dispensary_id) and not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_pin !~ '^\d{4,6}$' then
    raise exception 'PIN must be 4-6 digits' using errcode = '22023';
  end if;
  insert into public.pos_staff (dispensary_id, name, pin_hash)
  values (p_dispensary_id, btrim(p_name), crypt(p_pin, gen_salt('bf')))
  returning id into nid;
  return nid;
end; $$;
revoke all on function public.add_pos_staff(uuid, text, text) from public, anon;
grant execute on function public.add_pos_staff(uuid, text, text) to authenticated;

-- Verify a PIN → returns the matching active staff member (owner/admin context).
create or replace function public.verify_pos_staff(p_dispensary_id uuid, p_pin text)
returns table (id uuid, name text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.owns_dispensary(p_dispensary_id) and not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
    select s.id, s.name from public.pos_staff s
    where s.dispensary_id = p_dispensary_id and s.active
      and s.pin_hash = crypt(p_pin, s.pin_hash)
    limit 1;
end; $$;
revoke all on function public.verify_pos_staff(uuid, text) from public, anon;
grant execute on function public.verify_pos_staff(uuid, text) to authenticated;
