-- ════════════════════════════════════════════════════════════════════════════
-- 20260715120000_onboarding_profile_fields
--
-- Backs the new onboarding flows:
--   • welcomed_at — set the first time a user confirms their email, so the
--     welcome email fires exactly once and first-run routing (→ /welcome,
--     /claim, /for-brands) only triggers on genuine first activation.
--   • preferred_categories — favorite product categories a shopper picks in the
--     first-run step, used to personalize their feed. Slugs, not FKs, so it
--     stays cheap to read and tolerant of category churn.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists welcomed_at timestamptz,
  add column if not exists preferred_categories text[] not null default '{}';

-- A user may set their own preferred categories from the first-run/account UI.
-- (The existing profiles update policy already scopes writes to auth.uid();
--  no new policy needed — these columns fall under it.)
