-- Brand owners can read events for their own brand placements (which have no
-- dispensary_id), so the Brand Studio analytics show real impressions/clicks.
set search_path = public;

drop policy if exists placement_events_select on public.placement_events;
create policy placement_events_select on public.placement_events
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.placements p
      where p.id = placement_events.placement_id and public.owns_dispensary(p.dispensary_id)
    )
    or exists (
      select 1 from public.placements p
      join public.brands b on b.id = p.brand_id
      where p.id = placement_events.placement_id and b.owner_id = auth.uid()
    )
  );
