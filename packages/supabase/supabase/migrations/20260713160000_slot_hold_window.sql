-- ════════════════════════════════════════════════════════════════════════════
-- 20260713160000_slot_hold_window
--
-- Standalone extraction of the release_stale_ad_claims rewrite from
-- 20260713150000 so the hold-window fix can land independently of that
-- migration's destructive parts. Audit finding: prod's version cancels
-- pending holds after 30 MINUTES (tuned for abandoned card checkouts) while
-- the app now promises "the slot is held for you for 7 days" and the sales
-- team needs days, not minutes, to arrange invoicing — a reservation would
-- be gone before anyone could act on it. Body references no stripe columns,
-- so it is valid before AND after the column drops. Idempotent with the
-- (identical) definition in 20260713150000.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.release_stale_ad_claims()
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.ad_subscriptions
  set status = 'canceled', ends_at = now()
  where status = 'pending'
    and created_at < now() - interval '7 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
