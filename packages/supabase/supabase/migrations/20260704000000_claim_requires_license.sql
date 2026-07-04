-- ════════════════════════════════════════════════════════════════════════════
-- 20260704000000_claim_requires_license
-- Claims must be verifiable: a listing is only claimable when we hold its state
-- license number on file, since admins verify the claimer against that record.
-- The nationwide import left license_number NULL for some states (MT/NV column
-- gap); those rows become claimable automatically once numbers are backfilled —
-- no further migration needed.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

drop policy if exists ownership_requests_insert on public.ownership_requests;

-- A dispensary_owner may request to claim an UNCLAIMED, ACTIVE listing with a
-- LICENSE ON FILE, as themselves. (Same shape as before + the license check;
-- auth calls stay wrapped as init-plan subqueries per the RLS perf migration.)
create policy ownership_requests_insert on public.ownership_requests
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.auth_role()) = 'dispensary_owner'
    and exists (
      select 1 from public.dispensaries d
      where d.id = ownership_requests.dispensary_id
        and d.owner_id is null
        and d.status = 'active'
        and d.license_number is not null
    )
  );
