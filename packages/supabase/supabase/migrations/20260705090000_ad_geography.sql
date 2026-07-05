-- 20260705090000_ad_geography
-- Two-layer geographic ad system, layer tables.
--
--   • ad_markets  — metro markets ('los-angeles').
--   • ad_regions  — sellable advertiser territories (scarce inventory lives here).
--   • ad_zones    — small consumer search zones (3–7 mi neighborhood clusters).
--
-- Users search ZONES; advertisers buy REGIONS. Zones are never sold directly,
-- and territories are never divided by ZIP code. Boundaries are MultiPolygons
-- (SRID 4326) and may start NULL — resolve_geo() falls back to nearest zone
-- centroid until real polygons are drawn.

create table public.ad_markets (
  id         uuid primary key default extensions.gen_random_uuid(),
  slug       text not null,
  name       text not null,
  state      text not null default 'CA',
  created_at timestamptz not null default now(),
  constraint ad_markets_slug_key unique (slug)
);

comment on table public.ad_markets is 'Metro ad markets (e.g. Los Angeles). Container for advertiser regions.';

create type public.region_tier as enum ('A_PLUS', 'A', 'B_PLUS', 'B');

create table public.ad_regions (
  id                  uuid primary key default extensions.gen_random_uuid(),
  market_id           uuid not null references public.ad_markets (id) on delete cascade,
  slug                text not null,
  name                text not null,
  tier                public.region_tier not null,
  boundary            geometry(MultiPolygon, 4326),
  -- Exclusive sponsorship is negotiated within a per-region band (cents/month).
  exclusive_price_min integer,
  exclusive_price_max integer,
  is_active           boolean not null default true,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  constraint ad_regions_slug_key unique (slug),
  constraint ad_regions_exclusive_band check (
    exclusive_price_min is null
    or exclusive_price_max is null
    or exclusive_price_max >= exclusive_price_min
  )
);

comment on table public.ad_regions is 'Sellable advertiser territories. Fixed scarce slot inventory per region; tier anchors pricing.';

create table public.ad_zones (
  id         uuid primary key default extensions.gen_random_uuid(),
  region_id  uuid not null references public.ad_regions (id) on delete cascade,
  slug       text not null,
  name       text not null,
  boundary   geometry(MultiPolygon, 4326),
  centroid   geometry(Point, 4326),
  created_at timestamptz not null default now(),
  constraint ad_zones_slug_key unique (slug)
);

comment on table public.ad_zones is 'Consumer search zones (neighborhood clusters). Drive what users see; never sold directly.';

create index ad_regions_boundary_gix on public.ad_regions using gist (boundary);
create index ad_zones_boundary_gix on public.ad_zones using gist (boundary);
create index ad_zones_centroid_gix on public.ad_zones using gist (centroid);
create index ad_zones_region_idx on public.ad_zones (region_id);
create index ad_regions_market_idx on public.ad_regions (market_id);

-- ─── RLS: public read, no client writes ─────────────────────────────────────
alter table public.ad_markets enable row level security;
alter table public.ad_regions enable row level security;
alter table public.ad_zones enable row level security;

create policy "ad_markets_public_read" on public.ad_markets for select using (true);
create policy "ad_regions_public_read" on public.ad_regions for select using (true);
create policy "ad_zones_public_read" on public.ad_zones for select using (true);
