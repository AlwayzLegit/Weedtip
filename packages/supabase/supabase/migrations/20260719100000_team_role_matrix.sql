-- ════════════════════════════════════════════════════════════════════════════
-- 20260719100000_team_role_matrix
-- Expands the two-role team model (manager/staff) into the P4 role matrix:
--   Admin  = the owner (owner_id) — not a member row
--   manager          — operations: listing, menu, orders, reviews, analytics
--   campaign_manager — marketing: deals, promos, updates, analytics, menu
--   associate        — menu only (was "staff")
--
-- owns_dispensary() still grants any ACTIVE member shop-level DB access, so the
-- per-role limits are enforced in the app (nav + page + action gates). Making
-- RLS itself role-aware is a follow-up hardening step.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

update public.dispensary_members set role = 'associate' where role = 'staff';

alter table public.dispensary_members drop constraint if exists dispensary_members_role_check;
alter table public.dispensary_members
  add constraint dispensary_members_role_check
  check (role in ('manager', 'campaign_manager', 'associate'));
