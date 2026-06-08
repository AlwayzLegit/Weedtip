-- Billing for the brand featured auction: a bid is paid upfront for its 2-month
-- term via Stripe. Bids start 'pending' and only become 'active' (competing) once
-- the webhook confirms payment.
set search_path = public;

alter table public.brand_ad_bids drop constraint if exists brand_ad_bids_status_check;
alter table public.brand_ad_bids
  add constraint brand_ad_bids_status_check check (status in ('active', 'cancelled', 'pending'));

alter table public.brand_ad_bids
  add column if not exists stripe_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists paid_at timestamptz;

-- Called by the Stripe webhook (service role) after payment: promote a pending
-- bid to active for a fresh 2-month term, replacing any prior active bid for the
-- same brand+region. Idempotent (no-op if already activated).
create or replace function public.activate_brand_bid(p_bid_id uuid, p_payment_intent text default null)
returns void language plpgsql security definer set search_path = public as $$
declare b record;
begin
  select * into b from public.brand_ad_bids where id = p_bid_id and status = 'pending';
  if not found then return; end if;
  delete from public.brand_ad_bids
    where region_id = b.region_id and brand_id = b.brand_id and status = 'active' and id <> p_bid_id;
  update public.brand_ad_bids
    set status = 'active', contract_start = now(), contract_end = now() + interval '2 months',
        paid_at = now(), stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id),
        updated_at = now()
    where id = p_bid_id;
end; $$;
revoke all on function public.activate_brand_bid(uuid, text) from public, anon, authenticated;
grant execute on function public.activate_brand_bid(uuid, text) to service_role;
