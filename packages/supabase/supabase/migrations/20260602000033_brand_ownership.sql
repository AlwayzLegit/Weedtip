-- Brand ownership: a profile can claim and self-manage a brand (the brand-owner
-- side of brand product linking). Kept isolated from dispensary ownership_requests
-- so that flow's security is untouched.
alter table public.brands add column if not exists owner_id uuid references public.profiles(id) on delete set null;
create index if not exists brands_owner_idx on public.brands (owner_id);

create table if not exists public.brand_claims (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  message text,
  created_at timestamptz not null default now(),
  unique (brand_id, user_id)
);
alter table public.brand_claims enable row level security;

create policy brand_claims_insert_self on public.brand_claims
  for insert to authenticated with check (user_id = auth.uid());
create policy brand_claims_select on public.brand_claims
  for select using (user_id = auth.uid() or public.is_admin());
create policy brand_claims_admin on public.brand_claims
  for all using (public.is_admin()) with check (public.is_admin());

-- Owner self-edit: limited to presentation fields (never name/slug/owner).
create or replace function public.update_owned_brand(
  p_brand_id uuid, p_description text, p_logo_url text, p_website text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.brands where id = p_brand_id and owner_id = auth.uid()) then
    raise exception 'Not authorized for this brand' using errcode = '42501';
  end if;
  update public.brands
    set description = p_description, logo_url = p_logo_url, website = p_website, updated_at = now()
    where id = p_brand_id;
end; $$;
grant execute on function public.update_owned_brand(uuid, text, text, text) to authenticated;

-- Admin approves/rejects a brand claim; approval assigns ownership and auto-declines rivals.
create or replace function public.approve_brand_claim(p_claim_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c record;
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  select * into c from public.brand_claims where id = p_claim_id;
  if not found then raise exception 'Claim not found'; end if;
  update public.brands set owner_id = c.user_id where id = c.brand_id;
  update public.brand_claims set status = 'approved' where id = p_claim_id;
  update public.brand_claims set status = 'rejected'
    where brand_id = c.brand_id and id <> p_claim_id and status = 'pending';
end; $$;
grant execute on function public.approve_brand_claim(uuid) to authenticated;

create or replace function public.reject_brand_claim(p_claim_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  update public.brand_claims set status = 'rejected' where id = p_claim_id;
end; $$;
grant execute on function public.reject_brand_claim(uuid) to authenticated;
