-- ════════════════════════════════════════════════════════════════════════════
-- 20260719180000_claim_plan_preference
-- Tier-based claim funnel v1: claimers pick a starting plan during the claim.
-- Free stays the default; a paid preference becomes a pending sales-led
-- subscription request the moment the claim is approved (no card, reserve-
-- then-confirm as everywhere else).
-- ════════════════════════════════════════════════════════════════════════════
alter table public.ownership_requests
  add column if not exists plan_preference text not null default 'free'
    check (plan_preference in ('free', 'basic', 'growth'));
