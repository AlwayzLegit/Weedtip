-- Weedtip Pro bundles a Featured placement in the shop's own region. Grant it
-- automatically when the plan activates, instead of making the owner reserve it
-- and an admin activate it by hand.
--
-- Provenance matters for reporting and for the ad desk, so plan-included claims
-- are marked distinctly — but they behave like house fills economically:
--   * is_house = true      → excluded from slot_price_cents() step pricing (no
--                            incremental revenue, so they must not inflate the
--                            a-la-carte price), and preemptable by a real PAID
--                            buyer (protects scarce premium inventory).
--   * plan_included = true → "included with Weedtip Pro", not a hand-comped
--                            cold-start fill, so admin/owner UI can say so.
alter table public.ad_subscriptions
  add column if not exists plan_included boolean not null default false;

comment on column public.ad_subscriptions.plan_included is
  'Granted automatically as part of a paid plan (Weedtip Pro), not sold a-la-carte or hand-comped.';

-- Find plan-included claims fast when a plan activates/cancels.
create index if not exists ad_subscriptions_plan_included_idx
  on public.ad_subscriptions (dispensary_id)
  where plan_included;

/**
 * Atomically claim a slot as a plan-included placement. Mirrors claim_slot()
 * but lands ACTIVE at zero price and flags the row, so the placement is live
 * the moment the plan is. Raises SLOT_TAKEN when the slot already has a live
 * subscription (the partial unique index), so callers can try the next slot.
 */
create or replace function public.claim_plan_slot(
  p_slot_id uuid,
  p_dispensary_id uuid
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
begin
  insert into public.ad_subscriptions
    (slot_id, dispensary_id, status, price_paid, is_house, plan_included, starts_at)
  values
    (p_slot_id, p_dispensary_id, 'active', 0, true, true, now())
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'SLOT_TAKEN';
end;
$$;

revoke all on function public.claim_plan_slot(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_plan_slot(uuid, uuid) to service_role;
