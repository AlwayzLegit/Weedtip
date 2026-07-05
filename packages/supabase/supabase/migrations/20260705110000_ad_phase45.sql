-- 20260705110000_ad_phase45
-- Ad system Phase 4 (admin console: region/zone CRUD, GeoJSON boundaries,
-- slot occupancy, manual comps) and Phase 5 (first-party metrics that feed
-- dynamic pricing: searches / impressions / clicks per region).

-- ─── Phase 5: first-party ad event log ───────────────────────────────────────
-- PostHog captures ad_impression/ad_click for product analytics; this table is
-- the pricing system's OWN record so region metrics never depend on an
-- external vendor. Written only via the SECURITY DEFINER RPC below.
create table public.ad_events (
  id            uuid primary key default extensions.gen_random_uuid(),
  region_id     uuid not null references public.ad_regions (id) on delete cascade,
  zone_id       uuid references public.ad_zones (id) on delete set null,
  dispensary_id uuid references public.dispensaries (id) on delete set null,
  slot_type     public.ad_slot_type,
  event         text not null,
  created_at    timestamptz not null default now(),
  constraint ad_events_event_check check (event in ('search', 'impression', 'click'))
);

create index ad_events_region_time_idx on public.ad_events (region_id, created_at desc);

comment on table public.ad_events is 'First-party ad metrics (zone searches, slot impressions/clicks). Inputs to region pricing. Insert via record_ad_event() only.';

alter table public.ad_events enable row level security;
-- No policies: anon/authenticated cannot read or write rows directly.

-- Fire-and-forget event recorder for the public beacons. Validates everything
-- and silently drops garbage (it must never error a shopper's page).
create or replace function public.record_ad_event(
  p_region_id uuid,
  p_event text,
  p_zone_id uuid default null,
  p_dispensary_id uuid default null,
  p_slot_type public.ad_slot_type default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event not in ('search', 'impression', 'click') then return; end if;
  if not exists (select 1 from public.ad_regions where id = p_region_id) then return; end if;
  insert into public.ad_events (region_id, zone_id, dispensary_id, slot_type, event)
  values (
    p_region_id,
    case when exists (select 1 from public.ad_zones z where z.id = p_zone_id) then p_zone_id end,
    case when exists (select 1 from public.dispensaries d where d.id = p_dispensary_id) then p_dispensary_id end,
    p_slot_type,
    p_event
  );
end;
$$;

grant execute on function public.record_ad_event(uuid, text, uuid, uuid, public.ad_slot_type) to anon, authenticated;

-- ─── Phase 4: admin CRUD policies ────────────────────────────────────────────
create policy "ad_markets_admin_write" on public.ad_markets
  for all using (public.is_admin()) with check (public.is_admin());
create policy "ad_regions_admin_write" on public.ad_regions
  for all using (public.is_admin()) with check (public.is_admin());
create policy "ad_zones_admin_write" on public.ad_zones
  for all using (public.is_admin()) with check (public.is_admin());
create policy "ad_products_admin_write" on public.ad_products
  for all using (public.is_admin()) with check (public.is_admin());
create policy "ad_slots_admin_write" on public.ad_slots
  for all using (public.is_admin()) with check (public.is_admin());
create policy "ad_events_admin_read" on public.ad_events
  for select using (public.is_admin());

-- ─── Phase 4: boundary upload (paste GeoJSON in the admin console) ──────────
create or replace function public.admin_set_ad_boundary(
  p_kind text,
  p_id uuid,
  p_geojson text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_geom geometry;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_kind not in ('region', 'zone') then
    raise exception 'kind must be region or zone';
  end if;

  if p_geojson is null or btrim(p_geojson) = '' then
    v_geom := null; -- clearing a boundary is allowed
  else
    v_geom := st_setsrid(st_multi(st_geomfromgeojson(p_geojson)), 4326);
    if v_geom is null or not st_isvalid(v_geom) then
      raise exception 'GeoJSON is not a valid geometry';
    end if;
    if geometrytype(v_geom) <> 'MULTIPOLYGON' then
      raise exception 'Boundary must be a Polygon or MultiPolygon';
    end if;
  end if;

  if p_kind = 'region' then
    update public.ad_regions set boundary = v_geom where id = p_id;
  else
    update public.ad_zones set boundary = v_geom where id = p_id;
  end if;
end;
$$;

revoke execute on function public.admin_set_ad_boundary(text, uuid, text) from public, anon;
grant execute on function public.admin_set_ad_boundary(text, uuid, text) to authenticated;

-- ─── Phase 4: manual comp / negotiated exclusive (no Stripe) ─────────────────
create or replace function public.admin_comp_slot(
  p_slot_id uuid,
  p_dispensary_id uuid,
  p_price integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  insert into public.ad_subscriptions (slot_id, dispensary_id, status, price_paid, starts_at)
  values (p_slot_id, p_dispensary_id, 'active', greatest(coalesce(p_price, 0), 0), now())
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'SLOT_TAKEN';
end;
$$;

create or replace function public.admin_cancel_ad_subscription(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  update public.ad_subscriptions
  set status = 'canceled', ends_at = now()
  where id = p_subscription_id and status <> 'canceled';
end;
$$;

revoke execute on function public.admin_comp_slot(uuid, uuid, integer) from public, anon;
grant execute on function public.admin_comp_slot(uuid, uuid, integer) to authenticated;
revoke execute on function public.admin_cancel_ad_subscription(uuid) from public, anon;
grant execute on function public.admin_cancel_ad_subscription(uuid) to authenticated;

-- ─── Phase 5: per-region metrics rollup (admin dashboard) ────────────────────
create or replace function public.region_metrics(p_days integer default 30)
returns table (
  region_id uuid,
  searches bigint,
  impressions bigint,
  clicks bigint,
  live_subs bigint,
  active_revenue_cents bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    count(e.id) filter (where e.event = 'search'),
    count(e.id) filter (where e.event = 'impression'),
    count(e.id) filter (where e.event = 'click'),
    (select count(*) from public.ad_subscriptions sub
       join public.ad_slots s on s.id = sub.slot_id
      where s.region_id = r.id and sub.status in ('pending', 'active', 'past_due')),
    coalesce((select sum(sub.price_paid) from public.ad_subscriptions sub
       join public.ad_slots s on s.id = sub.slot_id
      where s.region_id = r.id and sub.status = 'active'), 0)
  from public.ad_regions r
  left join public.ad_events e
    on e.region_id = r.id
   and e.created_at > now() - make_interval(days => greatest(p_days, 1))
  where public.is_admin()
  group by r.id;
$$;

revoke execute on function public.region_metrics(integer) from public, anon;
grant execute on function public.region_metrics(integer) to authenticated;
