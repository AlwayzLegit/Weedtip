-- ════════════════════════════════════════════════════════════════════════════
-- 20260719140000_dispensary_audit_log
--
-- Listing change history (the last roadmap-② listing-editor parity item).
-- Every UPDATE on dispensaries records a field-level diff — who changed what,
-- when — so owners can audit edits from a multi-member team and admins can
-- trace moderation actions.
--
-- The diff is computed generically from to_jsonb(OLD/NEW) minus an exclusion
-- list of derived/noisy columns (search_vector, rating aggregates, AI summary,
-- timestamps), so new editable columns are captured automatically.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create table if not exists public.dispensary_audit_log (
  id            uuid primary key default extensions.gen_random_uuid(),
  dispensary_id uuid not null references public.dispensaries (id) on delete cascade,
  actor_id      uuid references public.profiles (id) on delete set null,
  changes       jsonb not null,
  created_at    timestamptz not null default now()
);

create index if not exists dispensary_audit_log_dispensary_idx
  on public.dispensary_audit_log (dispensary_id, created_at desc);

alter table public.dispensary_audit_log enable row level security;

-- Shop team + admins read their own history; writes happen only via trigger.
drop policy if exists dispensary_audit_select on public.dispensary_audit_log;
create policy dispensary_audit_select on public.dispensary_audit_log
  for select to authenticated
  using (public.owns_dispensary(dispensary_id) or public.is_admin());

create or replace function public.log_dispensary_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changes jsonb;
begin
  select jsonb_object_agg(o.key, jsonb_build_object('from', o.value, 'to', n.value))
    into v_changes
  from jsonb_each(to_jsonb(old)) o
  join jsonb_each(to_jsonb(new)) n on n.key = o.key
  where o.value is distinct from n.value
    and o.key not in (
      -- derived / machine-managed columns: not human edits
      'updated_at', 'created_at', 'search_vector', 'location',
      'rating_avg', 'rating_count',
      'reviews_summary', 'reviews_summary_at', 'reviews_summary_count',
      'google_photo_name', 'google_place_id', 'google_synced_at'
    );

  if v_changes is not null and v_changes <> '{}'::jsonb then
    insert into public.dispensary_audit_log (dispensary_id, actor_id, changes)
    values (new.id, auth.uid(), v_changes);
  end if;
  return new;
end;
$$;

drop trigger if exists dispensary_audit on public.dispensaries;
create trigger dispensary_audit
  after update on public.dispensaries
  for each row execute function public.log_dispensary_changes();
