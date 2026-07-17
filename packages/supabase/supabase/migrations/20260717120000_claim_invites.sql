-- ════════════════════════════════════════════════════════════════════════════
-- 20260717120000_claim_invites
--
-- Claim-invite outreach: one row per unclaimed listing we email, carrying an
-- unguessable token used for the tracked claim link and the unsubscribe link.
-- Admin-only table access; the public open/unsubscribe paths go through
-- token-keyed SECURITY DEFINER RPCs. claimed_at is stamped by trigger when a
-- listing gains an owner, so campaign conversion is measured automatically.
-- ════════════════════════════════════════════════════════════════════════════

create table public.claim_invites (
  id uuid primary key default gen_random_uuid(),
  dispensary_id uuid not null references public.dispensaries(id) on delete cascade,
  email text not null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  sent_at timestamptz,
  opened_at timestamptz,
  claimed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  -- One invite per listing; re-sends update the same row.
  unique (dispensary_id)
);

create index idx_claim_invites_email on public.claim_invites (email);

alter table public.claim_invites enable row level security;

create policy claim_invites_admin_select on public.claim_invites
  for select to authenticated using ((select is_admin()));
create policy claim_invites_admin_insert on public.claim_invites
  for insert to authenticated with check ((select is_admin()));
create policy claim_invites_admin_update on public.claim_invites
  for update to authenticated using ((select is_admin()));
create policy claim_invites_admin_delete on public.claim_invites
  for delete to authenticated using ((select is_admin()));

-- Tracked click: stamp opened_at (first open only) and hand back the listing
-- slug so the invite link can land on the shop page. Token is the only key —
-- unguessable, safe for anon execution.
create function public.claim_invite_open(p_token text)
returns table(slug text)
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  return query
  with hit as (
    update public.claim_invites ci
    set opened_at = coalesce(ci.opened_at, now())
    where ci.token = p_token
    returning ci.dispensary_id
  )
  select d.slug from hit join public.dispensaries d on d.id = hit.dispensary_id;
end;
$$;

-- CAN-SPAM unsubscribe: suppresses this email address from future sends.
create function public.claim_invite_unsubscribe(p_token text)
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
  -- Suppress every invite row sharing the address (chains share emails).
  update public.claim_invites
  set unsubscribed_at = coalesce(unsubscribed_at, now())
  where email = hit_email;
  return true;
end;
$$;

grant execute on function public.claim_invite_open(text) to anon, authenticated;
grant execute on function public.claim_invite_unsubscribe(text) to anon, authenticated;

-- Conversion stamp: when an invited listing gains an owner, mark the invite
-- claimed so the campaign funnel (sent → opened → claimed) is measurable.
create function public.stamp_claim_invite_claimed()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if new.owner_id is not null and old.owner_id is null then
    update public.claim_invites
    set claimed_at = coalesce(claimed_at, now())
    where dispensary_id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_stamp_claim_invite_claimed
  after update of owner_id on public.dispensaries
  for each row execute function public.stamp_claim_invite_claimed();
