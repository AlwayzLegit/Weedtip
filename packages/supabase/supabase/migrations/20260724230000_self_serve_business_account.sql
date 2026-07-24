-- ════════════════════════════════════════════════════════════════════════════
-- 20260724230000_self_serve_business_account
--
-- Role changes are admin-only, which is right for everything except one case:
-- a person who signed up as a shopper and later turns out to be a shop owner.
--
-- Today that is a dead end. `getOwnerContext` redirects them off /dashboard,
-- the claim action rejects them ("Only dispensary-owner accounts can claim a
-- listing"), and nothing anywhere offers a way forward — so their only option
-- is to abandon the account and sign up again with a different email.
--
-- This allows exactly one extra transition: consumer → dispensary_owner, on
-- your OWN row. That is the same choice sign-up already presents on its first
-- screen, so it grants no privilege that wasn't already self-service; it just
-- stops the funnel from dead-ending. Everything else is unchanged — no path to
-- 'admin', no editing anyone else's role, and RLS still scopes the write to
-- auth.uid(). Becoming an owner still confers nothing on its own: claims are
-- reviewed by an admin, and new listings start in `pending`.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create or replace function public.enforce_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and not public.is_admin()
     -- Self-serve switch to a business account (see migration header).
     and not (
       old.role = 'consumer'
       and new.role = 'dispensary_owner'
       and new.id = auth.uid()
     )
  then
    raise exception 'Only an admin can change a profile role'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
