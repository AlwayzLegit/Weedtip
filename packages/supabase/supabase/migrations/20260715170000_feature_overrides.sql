-- ════════════════════════════════════════════════════════════════════════════
-- 20260715170000_feature_overrides
--
-- GHL-style per-account feature control. Every gated feature normally follows
-- the dispensary's plan (Free vs Growth), but the super-admin can override any
-- feature per account — force it ON (comp/grandfather a shop) or OFF (suspend a
-- capability) regardless of plan. Absence of a row = "follow the plan default".
--
-- One row per (dispensary, feature). Owners can read their own overrides so the
-- dashboard renders the right gates; only admins write them.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.dispensary_feature_overrides (
  dispensary_id uuid not null references public.dispensaries (id) on delete cascade,
  feature_key   text not null,
  enabled       boolean not null,
  updated_at    timestamptz not null default now(),
  primary key (dispensary_id, feature_key)
);

alter table public.dispensary_feature_overrides enable row level security;

-- Owner reads their own overrides; admins read all (to manage the sub-account).
drop policy if exists feature_overrides_select on public.dispensary_feature_overrides;
create policy feature_overrides_select on public.dispensary_feature_overrides
  for select to authenticated
  using (
    exists (select 1 from public.dispensaries d
            where d.id = dispensary_id and d.owner_id = auth.uid())
    or public.is_admin()
  );

-- Only admins set overrides.
drop policy if exists feature_overrides_write on public.dispensary_feature_overrides;
create policy feature_overrides_write on public.dispensary_feature_overrides
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
