-- ════════════════════════════════════════════════════════════════════════════
-- 20260602000025_placement_events
-- Impression + click tracking for paid placements — the measurement layer ad
-- buyers expect (Weedmaps/Leafly bill on impressions). Events are written through
-- a SECURITY DEFINER RPC (callable by anon, since most viewers aren't logged in);
-- owners/admins read aggregated stats via a view gated by RLS.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create table public.placement_events (
  id bigint generated always as identity primary key,
  placement_id uuid not null references public.placements(id) on delete cascade,
  event_type text not null check (event_type in ('impression', 'click')),
  created_at timestamptz not null default now()
);
create index placement_events_pid_idx on public.placement_events (placement_id, event_type);
create index placement_events_created_idx on public.placement_events (created_at);

alter table public.placement_events enable row level security;

-- Owners read their own placements' events; admins read all. Writes go through
-- the RPC only (its SECURITY DEFINER rights bypass RLS), so no insert policy.
create policy placement_events_select on public.placement_events
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.placements p
      where p.id = placement_id and public.owns_dispensary(p.dispensary_id)
    )
  );

create or replace function public.record_placement_event(p_placement_id uuid, p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_type not in ('impression', 'click') then
    return;
  end if;
  if not exists (select 1 from public.placements where id = p_placement_id) then
    return;
  end if;
  insert into public.placement_events (placement_id, event_type)
  values (p_placement_id, p_type);
end;
$$;
grant execute on function public.record_placement_event(uuid, text) to anon, authenticated;

-- Aggregated stats per placement (RLS of placement_events applies to the caller).
create view public.placement_stats
with (security_invoker = true) as
select
  placement_id,
  count(*) filter (where event_type = 'impression') as impressions,
  count(*) filter (where event_type = 'click') as clicks
from public.placement_events
group by placement_id;
