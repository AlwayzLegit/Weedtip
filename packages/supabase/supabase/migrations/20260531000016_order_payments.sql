-- ════════════════════════════════════════════════════════════════════════════
-- 20260531000016_order_payments
-- Payment tracking for orders, enabling online prepayment via Stripe Checkout
-- alongside the existing pay-at-dispensary flow.
--
-- Orders are created `unpaid`. The Stripe webhook (service-role, bypasses RLS)
-- flips payment_status → 'paid' and status → 'confirmed' on
-- checkout.session.completed. Stores the session + payment-intent ids for
-- reconciliation/refunds. When Stripe isn't configured, orders simply stay
-- 'unpaid' with payment_method 'in_person' (pay at the dispensary).
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum ('unpaid', 'paid', 'refunded');
  end if;
end
$$;

alter table public.orders
  add column if not exists payment_status public.payment_status not null default 'unpaid',
  add column if not exists payment_method text,                 -- 'stripe' | 'in_person' | null
  add column if not exists stripe_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists paid_at timestamptz;

-- Webhook looks orders up by session id; partial index keeps it lean.
create index if not exists orders_stripe_session_id_idx
  on public.orders (stripe_session_id)
  where stripe_session_id is not null;

comment on column public.orders.payment_status is
  'unpaid (pay at dispensary, or Stripe session not yet completed), paid (Stripe confirmed), refunded';
comment on column public.orders.payment_method is
  'How the order is/was paid: stripe (online prepay) or in_person (at the dispensary).';
