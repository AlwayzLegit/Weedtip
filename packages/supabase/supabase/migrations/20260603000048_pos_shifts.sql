-- POS shifts / cash drawer: open a shift with a starting float, ring sales, close
-- with a counted cash amount → an end-of-shift "Z-report" (expected vs counted,
-- sales by payment method).
set search_path = public;

create table if not exists public.pos_shifts (
  id uuid primary key default gen_random_uuid(),
  dispensary_id uuid not null references public.dispensaries(id) on delete cascade,
  opened_by uuid not null references public.profiles(id),
  opened_at timestamptz not null default now(),
  opening_float_cents integer not null default 0,
  closed_at timestamptz,
  closed_by uuid references public.profiles(id),
  closing_count_cents integer,
  expected_cash_cents integer,
  cash_sales_cents integer not null default 0,
  card_sales_cents integer not null default 0,
  debit_sales_cents integer not null default 0,
  sales_count integer not null default 0,
  over_short_cents integer,
  notes text,
  created_at timestamptz not null default now()
);
-- At most one open shift per dispensary.
create unique index if not exists pos_shifts_one_open
  on public.pos_shifts (dispensary_id) where closed_at is null;
create index if not exists pos_shifts_disp_idx on public.pos_shifts (dispensary_id, opened_at desc);

alter table public.pos_shifts enable row level security;

create policy pos_shifts_all on public.pos_shifts
  for all
  using (public.owns_dispensary(dispensary_id) or public.is_admin())
  with check (public.owns_dispensary(dispensary_id) or public.is_admin());
