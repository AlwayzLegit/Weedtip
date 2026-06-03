-- Strain detail enrichment (Leafly-style): cannabinoid range, terpenes, the
-- negative side of effects, medical uses, grow info, simple genetics, and a
-- community "saves" count.
set search_path = public;

alter table public.strains
  add column if not exists cbd_low numeric(5,2),
  add column if not exists cbd_high numeric(5,2),
  add column if not exists terpenes text[] not null default '{}',
  add column if not exists negative_effects text[] not null default '{}',
  add column if not exists medical_uses text[] not null default '{}',
  add column if not exists grow_difficulty text,
  add column if not exists flowering_days_min integer,
  add column if not exists flowering_days_max integer,
  add column if not exists yield_note text,
  add column if not exists grow_notes text,
  add column if not exists parents text[] not null default '{}',
  add column if not exists saves_count integer not null default 0;

-- Per-user strain favorites (the heart/save action).
create table if not exists public.strain_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  strain_id uuid not null references public.strains(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, strain_id)
);
alter table public.strain_favorites enable row level security;

create policy strain_favorites_select on public.strain_favorites
  for select to authenticated using (user_id = auth.uid());
create policy strain_favorites_insert on public.strain_favorites
  for insert to authenticated with check (user_id = auth.uid());
create policy strain_favorites_delete on public.strain_favorites
  for delete to authenticated using (user_id = auth.uid());

-- Keep strains.saves_count in sync (SECURITY DEFINER: writes the admin-guarded
-- strains table from a shopper-triggered favorite, same pattern as rating sync).
create or replace function public.strain_favorites_count_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.strains set saves_count = saves_count + 1 where id = new.strain_id;
  elsif tg_op = 'DELETE' then
    update public.strains set saves_count = greatest(0, saves_count - 1) where id = old.strain_id;
  end if;
  return null;
end; $$;

create trigger strain_favorites_count_ins
  after insert on public.strain_favorites
  for each row execute function public.strain_favorites_count_sync();
create trigger strain_favorites_count_del
  after delete on public.strain_favorites
  for each row execute function public.strain_favorites_count_sync();
