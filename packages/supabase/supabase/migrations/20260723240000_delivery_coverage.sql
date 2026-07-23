-- ════════════════════════════════════════════════════════════════════════════
-- 20260723240000_delivery_coverage
-- Map-audit T7 — "who delivers to MY address?"
--
-- Delivery-only listings publish a **service-area county** (the DCC only makes
-- the county public, not a premise polygon), so coverage is matched at the
-- county level: an address → its county → the delivery services that list that
-- county. This adds:
--   • deliveries_serving_county(state, county) — the point-to-coverage lookup,
--     SECURITY DEFINER so anon can read it past the owner-scoped bits.
--   • informational delivery terms (minimum / fee / ETA) shown "as listed by
--     shop" — purely display; Weedtip never carts or checks out.
--
-- Not modeled here: true per-store zone polygons on the map. That needs county
-- boundary geometry we don't store (or claimed shops drawing zones); county-
-- match is the honest coverage the published data supports. Follow-up.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

alter table public.dispensaries
  add column if not exists delivery_minimum_cents integer,
  add column if not exists delivery_fee_cents integer,
  add column if not exists delivery_eta_minutes integer;

-- Existing rows are all NULL, so these validate immediately.
alter table public.dispensaries
  add constraint dispensaries_delivery_minimum_cents_chk
    check (delivery_minimum_cents is null or delivery_minimum_cents between 0 and 100000),
  add constraint dispensaries_delivery_fee_cents_chk
    check (delivery_fee_cents is null or delivery_fee_cents between 0 and 100000),
  add constraint dispensaries_delivery_eta_minutes_chk
    check (delivery_eta_minutes is null or delivery_eta_minutes between 0 and 600);

comment on column public.dispensaries.delivery_minimum_cents is
  'Delivery order minimum in cents, as listed by the shop (informational; Weedtip has no checkout).';
comment on column public.dispensaries.delivery_fee_cents is
  'Delivery fee in cents, as listed by the shop (informational).';
comment on column public.dispensaries.delivery_eta_minutes is
  'Typical delivery ETA in minutes, as listed by the shop (informational).';

-- Backs the county lookup: (state, normalized county) over delivery listings.
create index if not exists idx_dispensaries_delivery_county
  on public.dispensaries (state, lower(county))
  where is_delivery and county is not null;

-- ── Point-to-coverage: which delivery services list this county? ────────────
-- Callers normalize an address to (state, county) via the geocoder; we strip a
-- trailing "County" and match case-insensitively against the listing's public
-- service-area county.
create or replace function public.deliveries_serving_county(
  p_state text,
  p_county text
)
returns table(
  id uuid,
  slug text,
  name text,
  county text,
  state character,
  cover_image_url text,
  logo_url text,
  is_medical boolean,
  is_recreational boolean,
  rating_avg numeric,
  rating_count integer,
  licensed boolean,
  featured boolean,
  delivery_minimum_cents integer,
  delivery_fee_cents integer,
  delivery_eta_minutes integer
)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
  select
    d.id, d.slug, d.name, d.county, d.state,
    d.cover_image_url, d.logo_url,
    d.is_medical, d.is_recreational,
    d.rating_avg, d.rating_count,
    (d.license_number is not null and d.license_number <> '') as licensed,
    d.featured,
    d.delivery_minimum_cents, d.delivery_fee_cents, d.delivery_eta_minutes
  from public.dispensaries d
  where d.status = 'active'
    and d.is_delivery
    and d.county is not null
    and d.state = upper(btrim(p_state))
    and lower(btrim(d.county)) = lower(btrim(regexp_replace(p_county, '\s+county$', '', 'i')))
  order by d.featured desc, d.rating_avg desc nulls last, d.rating_count desc, d.name
  limit 200;
$function$;

grant execute on function public.deliveries_serving_county(text, text) to anon, authenticated;
