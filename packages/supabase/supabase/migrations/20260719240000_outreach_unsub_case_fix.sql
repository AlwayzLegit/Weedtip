-- ════════════════════════════════════════════════════════════════════════════
-- 20260719240000_outreach_unsub_case_fix
-- QA finding: unsubscribe propagation matched email case-SENSITIVELY, so the
-- same mailbox stored with different casing on another shop's invite could be
-- emailed again (CAN-SPAM). Propagate suppression case-insensitively.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.claim_invite_unsubscribe(p_token text)
returns boolean
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  hit_email text;
begin
  update public.claim_invites
  set unsubscribed_at = coalesce(unsubscribed_at, now())
  where token = p_token
  returning email into hit_email;
  if hit_email is null then
    return false;
  end if;
  -- Suppress every invite row sharing the address (chains share emails),
  -- regardless of stored casing.
  update public.claim_invites
  set unsubscribed_at = coalesce(unsubscribed_at, now())
  where lower(email) = lower(hit_email);
  return true;
end;
$$;
