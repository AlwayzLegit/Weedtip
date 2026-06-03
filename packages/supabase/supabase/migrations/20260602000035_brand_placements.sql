-- Brand-level sponsored placements: a brand owner pays to promote their brand
-- (nationwide; brands aren't geo-scoped). Reuses the placements table so brand
-- promos inherit the same activation, billing, and event tracking.
set search_path = public;

alter table public.placements add column if not exists brand_id uuid references public.brands(id) on delete cascade;
alter table public.placements alter column dispensary_id drop not null;
create index if not exists placements_brand_idx on public.placements (brand_id);

-- A placement promotes exactly one subject: a brand (promoted_brand) or a
-- dispensary/its items (every other type).
alter table public.placements add constraint placements_subject_chk check (
  (type = 'promoted_brand' and brand_id is not null and dispensary_id is null)
  or (type <> 'promoted_brand' and dispensary_id is not null and brand_id is null)
);

create or replace function public.owns_brand(p_brand_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.brands where id = p_brand_id and owner_id = auth.uid()
  );
$$;
revoke all on function public.owns_brand(uuid) from public, anon;
grant execute on function public.owns_brand(uuid) to authenticated;

-- Let brand owners see their own placements (pending ones aren't is_active yet).
alter policy placements_select on public.placements
  using (is_active or public.is_admin() or public.owns_dispensary(dispensary_id) or public.owns_brand(brand_id));

-- Recreate the live view so it carries the new brand_id column.
create or replace view public.active_placements
with (security_invoker = true) as
select * from public.placements
where is_active and starts_at <= now() and (ends_at is null or ends_at >= now());
