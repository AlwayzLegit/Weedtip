-- ════════════════════════════════════════════════════════════════════════════
-- 20260602000026_billing
-- Self-serve Stripe billing support. Subscriptions and one-time placement
-- purchases are synced from the Stripe webhook, which runs as the service role
-- (no user session). Activating a paid featured placement must re-sync the
-- effective featured flag, so grant the service role execute on that function.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

grant execute on function public.sync_featured_flags(uuid) to service_role;
