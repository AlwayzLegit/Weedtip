-- 20260705090003_ad_seed
-- Seed the Los Angeles market: 18 advertiser regions (10 non-Valley + 8 San
-- Fernando Valley), their consumer zones (with approximate centroids for the
-- nearest-centroid resolver — polygons come later), the price book, and the
-- fixed slot inventory (1 exclusive + 3 featured + 10 premium per region).
--
-- Glendale lives in glendale-nela (NOT the Valley); Burbank lives in the
-- Valley's noho-burbank region. The Valley uses the fine 8-region model in
-- place of coarse west-valley/east-valley rows.

-- ─── Market ──────────────────────────────────────────────────────────────────
insert into public.ad_markets (slug, name, state)
values ('los-angeles', 'Los Angeles', 'CA')
on conflict (slug) do nothing;

-- ─── Regions ─────────────────────────────────────────────────────────────────
-- Non-Valley exclusive bands come from the tier bands
-- (A+ $5,000–10,000 · A $3,500–7,500 · B+/B $2,000–5,000); SFV regions carry
-- their negotiated per-region bands. All prices in cents/month.
with m as (select id from public.ad_markets where slug = 'los-angeles')
insert into public.ad_regions
  (market_id, slug, name, tier, exclusive_price_min, exclusive_price_max, sort_order)
select m.id, r.slug, r.name, r.tier::public.region_tier, r.exc_min, r.exc_max, r.ord
from m,
  (values
    -- 10 non-Valley regions
    ('westside',                    'Westside',                       'A_PLUS',  500000, 1000000,  1),
    ('beverly-hollywood',           'Beverly / Hollywood',            'A_PLUS',  500000, 1000000,  2),
    ('central-la',                  'Central LA',                     'A',       350000,  750000,  3),
    ('downtown-eastside',           'Downtown / Eastside',            'A',       350000,  750000,  4),
    ('south-la',                    'South LA',                       'B_PLUS',  200000,  500000,  5),
    ('south-bay',                   'South Bay',                      'A',       350000,  750000,  6),
    ('long-beach',                  'Long Beach',                     'A',       350000,  750000,  7),
    ('glendale-nela',               'Glendale / Northeast LA',        'A',       350000,  750000,  8),
    ('san-gabriel-valley',          'San Gabriel Valley',             'B_PLUS',  200000,  500000,  9),
    ('north-la-county',             'North LA County',                'B',       200000,  500000, 10),
    -- 8 San Fernando Valley regions (per-region exclusive bands)
    ('studio-city-sherman-oaks',    'Studio City / Sherman Oaks',     'A_PLUS',  750000, 1200000, 11),
    ('noho-burbank',                'North Hollywood / Burbank',      'A_PLUS',  600000, 1000000, 12),
    ('encino-tarzana',              'Encino / Tarzana',               'A_PLUS',  750000, 1200000, 13),
    ('woodland-hills-west-valley',  'Woodland Hills / West Valley',   'A',       500000,  800000, 14),
    ('reseda-northridge',           'Reseda / Northridge',            'A',       400000,  700000, 15),
    ('van-nuys-panorama',           'Van Nuys / Panorama City',       'B_PLUS',  500000,  800000, 16),
    ('granada-hills-north-valley',  'Granada Hills / North Valley',   'B_PLUS',  350000,  600000, 17),
    ('sylmar-san-fernando',         'Sylmar / San Fernando',          'B',       250000,  500000, 18)
  ) as r(slug, name, tier, exc_min, exc_max, ord)
on conflict (slug) do nothing;

-- ─── Zones ───────────────────────────────────────────────────────────────────
-- Centroids are approximate community centers (lng, lat) used by the
-- nearest-centroid fallback in resolve_geo() until polygons are drawn.
with z(region_slug, slug, name, lng, lat) as (
  values
    -- Westside
    ('westside', 'santa-monica',   'Santa Monica',   -118.4912, 34.0195),
    ('westside', 'venice',         'Venice',         -118.4695, 33.9850),
    ('westside', 'marina-del-rey', 'Marina del Rey', -118.4517, 33.9803),
    ('westside', 'west-la',        'West LA',        -118.4400, 34.0400),
    ('westside', 'brentwood',      'Brentwood',      -118.4695, 34.0520),
    ('westside', 'westwood',       'Westwood',       -118.4452, 34.0561),
    -- Beverly / Hollywood
    ('beverly-hollywood', 'beverly-hills',  'Beverly Hills',  -118.4004, 34.0736),
    ('beverly-hollywood', 'west-hollywood', 'West Hollywood', -118.3617, 34.0900),
    ('beverly-hollywood', 'hollywood',      'Hollywood',      -118.3287, 34.0928),
    ('beverly-hollywood', 'fairfax',        'Fairfax',        -118.3615, 34.0780),
    ('beverly-hollywood', 'melrose',        'Melrose',        -118.3444, 34.0838),
    -- Central LA
    ('central-la', 'koreatown',    'Koreatown',    -118.3009, 34.0577),
    ('central-la', 'mid-wilshire', 'Mid-Wilshire', -118.3350, 34.0620),
    ('central-la', 'mid-city',     'Mid-City',     -118.3489, 34.0480),
    ('central-la', 'pico-union',   'Pico-Union',   -118.2833, 34.0470),
    -- Downtown / Eastside
    ('downtown-eastside', 'dtla',           'Downtown LA',   -118.2437, 34.0407),
    ('downtown-eastside', 'arts-district',  'Arts District', -118.2323, 34.0403),
    ('downtown-eastside', 'echo-park',      'Echo Park',     -118.2606, 34.0782),
    ('downtown-eastside', 'silver-lake',    'Silver Lake',   -118.2703, 34.0869),
    ('downtown-eastside', 'boyle-heights',  'Boyle Heights', -118.2201, 34.0303),
    -- South LA
    ('south-la', 'usc',           'USC',           -118.2851, 34.0224),
    ('south-la', 'crenshaw',      'Crenshaw',      -118.3348, 34.0104),
    ('south-la', 'leimert-park',  'Leimert Park',  -118.3298, 34.0067),
    ('south-la', 'inglewood',     'Inglewood',     -118.3531, 33.9617),
    ('south-la', 'south-central', 'South Central', -118.2718, 33.9890),
    -- South Bay
    ('south-bay', 'torrance',        'Torrance',        -118.3406, 33.8358),
    ('south-bay', 'redondo-beach',   'Redondo Beach',   -118.3884, 33.8492),
    ('south-bay', 'manhattan-beach', 'Manhattan Beach', -118.4109, 33.8847),
    ('south-bay', 'gardena',         'Gardena',         -118.3090, 33.8883),
    ('south-bay', 'hawthorne',       'Hawthorne',       -118.3526, 33.9164),
    -- Long Beach
    ('long-beach', 'long-beach',  'Long Beach',  -118.1937, 33.7701),
    ('long-beach', 'signal-hill', 'Signal Hill', -118.1678, 33.8047),
    ('long-beach', 'lakewood',    'Lakewood',    -118.1339, 33.8536),
    -- Glendale / Northeast LA (Glendale is NOT a Valley zone)
    ('glendale-nela', 'glendale',      'Glendale',      -118.2551, 34.1425),
    ('glendale-nela', 'eagle-rock',    'Eagle Rock',    -118.2107, 34.1394),
    ('glendale-nela', 'highland-park', 'Highland Park', -118.1926, 34.1115),
    ('glendale-nela', 'pasadena',      'Pasadena',      -118.1445, 34.1478),
    -- San Gabriel Valley
    ('san-gabriel-valley', 'alhambra',      'Alhambra',      -118.1270, 34.0953),
    ('san-gabriel-valley', 'monterey-park', 'Monterey Park', -118.1228, 34.0625),
    ('san-gabriel-valley', 'el-monte',      'El Monte',      -118.0276, 34.0686),
    ('san-gabriel-valley', 'west-covina',   'West Covina',   -117.9390, 34.0686),
    ('san-gabriel-valley', 'arcadia',       'Arcadia',       -118.0353, 34.1397),
    -- North LA County
    ('north-la-county', 'santa-clarita', 'Santa Clarita', -118.5426, 34.3917),
    ('north-la-county', 'palmdale',      'Palmdale',      -118.1165, 34.5794),
    ('north-la-county', 'lancaster',     'Lancaster',     -118.1542, 34.6868),
    -- SFV: Studio City / Sherman Oaks
    ('studio-city-sherman-oaks', 'studio-city',    'Studio City',    -118.3965, 34.1395),
    ('studio-city-sherman-oaks', 'sherman-oaks',   'Sherman Oaks',   -118.4514, 34.1490),
    ('studio-city-sherman-oaks', 'valley-village', 'Valley Village', -118.3963, 34.1650),
    -- SFV: North Hollywood / Burbank (Burbank lives here, not in glendale-nela)
    ('noho-burbank', 'north-hollywood', 'North Hollywood', -118.3782, 34.1720),
    ('noho-burbank', 'toluca-lake',     'Toluca Lake',     -118.3534, 34.1522),
    ('noho-burbank', 'valley-glen',     'Valley Glen',     -118.4180, 34.1830),
    ('noho-burbank', 'burbank',         'Burbank',         -118.3090, 34.1808),
    -- SFV: Encino / Tarzana
    ('encino-tarzana', 'encino',      'Encino',      -118.5010, 34.1592),
    ('encino-tarzana', 'tarzana',     'Tarzana',     -118.5534, 34.1734),
    ('encino-tarzana', 'lake-balboa', 'Lake Balboa', -118.5000, 34.1810),
    -- SFV: Woodland Hills / West Valley
    ('woodland-hills-west-valley', 'woodland-hills', 'Woodland Hills', -118.6059, 34.1683),
    ('woodland-hills-west-valley', 'west-hills',     'West Hills',     -118.6448, 34.1973),
    ('woodland-hills-west-valley', 'canoga-park',    'Canoga Park',    -118.5977, 34.2011),
    ('woodland-hills-west-valley', 'winnetka',       'Winnetka',       -118.5710, 34.2132),
    -- SFV: Reseda / Northridge (Porter Ranch stays here)
    ('reseda-northridge', 'reseda',       'Reseda',       -118.5360, 34.2011),
    ('reseda-northridge', 'northridge',   'Northridge',   -118.5365, 34.2283),
    ('reseda-northridge', 'porter-ranch', 'Porter Ranch', -118.5626, 34.2786),
    -- SFV: Van Nuys / Panorama City
    ('van-nuys-panorama', 'van-nuys',      'Van Nuys',      -118.4489, 34.1867),
    ('van-nuys-panorama', 'panorama-city', 'Panorama City', -118.4420, 34.2273),
    ('van-nuys-panorama', 'arleta',        'Arleta',        -118.4321, 34.2411),
    ('van-nuys-panorama', 'mission-hills', 'Mission Hills', -118.4676, 34.2570),
    -- SFV: Granada Hills / North Valley
    ('granada-hills-north-valley', 'granada-hills', 'Granada Hills', -118.5185, 34.2728),
    ('granada-hills-north-valley', 'north-hills',   'North Hills',   -118.4842, 34.2360),
    ('granada-hills-north-valley', 'chatsworth',    'Chatsworth',    -118.6012, 34.2572),
    -- SFV: Sylmar / San Fernando
    ('sylmar-san-fernando', 'sylmar',       'Sylmar',                -118.4490, 34.3078),
    ('sylmar-san-fernando', 'pacoima',      'Pacoima',               -118.4101, 34.2620),
    ('sylmar-san-fernando', 'sun-valley',   'Sun Valley',            -118.3702, 34.2170),
    ('sylmar-san-fernando', 'san-fernando', 'City of San Fernando',  -118.4390, 34.2819)
)
insert into public.ad_zones (region_id, slug, name, centroid)
select r.id, z.slug, z.name, st_setsrid(st_makepoint(z.lng, z.lat), 4326)
from z
join public.ad_regions r on r.slug = z.region_slug
on conflict (slug) do nothing;

-- ─── Price book ──────────────────────────────────────────────────────────────
-- Target (list) monthly pricing per slot type × tier; launch pricing at ~30%
-- of list (the 25–40% intro band). Exclusive rows carry the tier band MINIMUM
-- as list — actual exclusive deals are negotiated within each region's band.
insert into public.ad_products (slot_type, tier, list_price, launch_price)
values
  ('standard',  'A_PLUS',    9900,   2900),
  ('standard',  'A',         9900,   2900),
  ('standard',  'B_PLUS',    7900,   2400),
  ('standard',  'B',         7900,   2400),
  ('premium',   'A_PLUS',   49900,  14900),
  ('premium',   'A',        39900,  11900),
  ('premium',   'B_PLUS',   29900,   8900),
  ('premium',   'B',        29900,   8900),
  ('featured',  'A_PLUS',  150000,  45000),
  ('featured',  'A',       100000,  30000),
  ('featured',  'B_PLUS',   75000,  22500),
  ('featured',  'B',        75000,  22500),
  ('exclusive', 'A_PLUS',  500000, 150000),
  ('exclusive', 'A',       350000, 105000),
  ('exclusive', 'B_PLUS',  200000,  60000),
  ('exclusive', 'B',       200000,  60000)
on conflict (slot_type, tier) do nothing;

-- ─── Slots ───────────────────────────────────────────────────────────────────
-- 1 exclusive + 3 featured + 10 premium per region = 14 × 18 regions = 252.
insert into public.ad_slots (region_id, slot_type, position)
select r.id, 'exclusive'::public.ad_slot_type, 1 from public.ad_regions r
union all
select r.id, 'featured', gs from public.ad_regions r, generate_series(1, 3) gs
union all
select r.id, 'premium', gs from public.ad_regions r, generate_series(1, 10) gs
on conflict (region_id, slot_type, position) do nothing;
