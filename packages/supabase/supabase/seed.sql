-- ════════════════════════════════════════════════════════════════════════════
-- seed.sql — reference + demo data applied after migrations on `supabase db reset`.
-- Idempotent: safe to re-run. Contains NO user/PII data.
--
-- Sections:
--   1. Product categories            (reference)
--   2. Operating regions             (reference / compliance)
--   3. Demo dispensary               (1 listing — Green Leaf NYC — for local testing)
--   4. Demo product catalog          (Green Leaf NYC menu)
--   5. Demo deal                     (Green Leaf NYC promotion)
--
-- Real production data (the licensed CA dispensaries, brands, and their generated
-- menus/catalogs) is loaded via migrations + the importer, not here. This file
-- keeps a single demo shop so local dev / claim-flow testing has something to use.
--
-- Strains (migration 0012) and brands (migration 0014) are referenced by slug, so
-- this file is independent of their generated UUIDs. Dispensary status/featured are
-- only set on INSERT (the admin-guard trigger fires on UPDATE), so re-runs are safe.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Product categories (mirror @weedtip/shared PRODUCT_CATEGORIES) ────────
insert into public.categories (name, slug, icon, sort_order) values
  ('Flower',       'flower',       'cannabis', 10),
  ('Pre-rolls',    'pre-rolls',    'joint',    20),
  ('Vapes',        'vapes',        'vape',     30),
  ('Edibles',      'edibles',      'cookie',   40),
  ('Concentrates', 'concentrates', 'droplet',  50),
  ('Topicals',     'topicals',     'hand',     60),
  ('Tinctures',    'tinctures',    'pipette',  70),
  ('Accessories',  'accessories',  'package',  80)
on conflict (slug) do update
  set name = excluded.name,
      icon = excluded.icon,
      sort_order = excluded.sort_order;

-- ─── 2. Operating regions (legality + min age) ───────────────────────────────
-- ⚠️  COMPLIANCE: these flags are a development seed and an APPROXIMATION. Cannabis
-- legality changes frequently and varies by locality. Verify against current law /
-- legal counsel before relying on this in production gating decisions.
insert into public.operating_regions (state, is_medical_legal, is_recreational_legal, min_age, notes) values
  ('AL', true,  false, 21, 'Medical only'),
  ('AK', true,  true,  21, NULL),
  ('AZ', true,  true,  21, NULL),
  ('AR', true,  false, 21, 'Medical only'),
  ('CA', true,  true,  21, NULL),
  ('CO', true,  true,  21, NULL),
  ('CT', true,  true,  21, NULL),
  ('DE', true,  true,  21, NULL),
  ('DC', true,  true,  21, 'Recreational legal; retail sales restricted'),
  ('FL', true,  false, 21, 'Medical only'),
  ('GA', true,  false, 21, 'Low-THC medical only'),
  ('HI', true,  false, 21, 'Medical only'),
  ('ID', false, false, 21, 'Cannabis illegal'),
  ('IL', true,  true,  21, NULL),
  ('IN', false, false, 21, 'Cannabis illegal'),
  ('IA', true,  false, 21, 'Low-THC medical only'),
  ('KS', false, false, 21, 'Cannabis illegal'),
  ('KY', true,  false, 21, 'Medical program rolling out'),
  ('LA', true,  false, 21, 'Medical only'),
  ('ME', true,  true,  21, NULL),
  ('MD', true,  true,  21, NULL),
  ('MA', true,  true,  21, NULL),
  ('MI', true,  true,  21, NULL),
  ('MN', true,  true,  21, NULL),
  ('MS', true,  false, 21, 'Medical only'),
  ('MO', true,  true,  21, NULL),
  ('MT', true,  true,  21, NULL),
  ('NE', false, false, 21, 'Medical pending implementation'),
  ('NV', true,  true,  21, NULL),
  ('NH', true,  false, 21, 'Medical only'),
  ('NJ', true,  true,  21, NULL),
  ('NM', true,  true,  21, NULL),
  ('NY', true,  true,  21, NULL),
  ('NC', false, false, 21, 'Cannabis illegal'),
  ('ND', true,  false, 21, 'Medical only'),
  ('OH', true,  true,  21, NULL),
  ('OK', true,  false, 21, 'Medical only'),
  ('OR', true,  true,  21, NULL),
  ('PA', true,  false, 21, 'Medical only'),
  ('RI', true,  true,  21, NULL),
  ('SC', false, false, 21, 'Cannabis illegal'),
  ('SD', true,  false, 21, 'Medical only'),
  ('TN', false, false, 21, 'Cannabis illegal'),
  ('TX', true,  false, 21, 'Low-THC medical only'),
  ('UT', true,  false, 21, 'Medical only'),
  ('VT', true,  true,  21, NULL),
  ('VA', true,  true,  21, 'Possession legal; retail limited'),
  ('WA', true,  true,  21, NULL),
  ('WV', true,  false, 21, 'Medical only'),
  ('WI', false, false, 21, 'Cannabis illegal'),
  ('WY', false, false, 21, 'Cannabis illegal')
on conflict (state) do update
  set is_medical_legal = excluded.is_medical_legal,
      is_recreational_legal = excluded.is_recreational_legal,
      min_age = excluded.min_age,
      notes = excluded.notes;

-- ─── 3. Demo dispensary ──────────────────────────────────────────────────────
-- A single demo listing for local development and claim-flow testing. owner_id is
-- null (a public marketplace listing; the claim flow attaches an owner later).
-- location is geography(Point,4326) as POINT(lng lat); latitude/longitude are
-- GENERATED from it. status/featured set on INSERT only (see header note).
insert into public.dispensaries
  (id, name, slug, description, address, city, state, zip, phone, email, website,
   logo_url, cover_image_url, license_number, is_medical, is_recreational, is_delivery,
   is_pickup, hours, location, status, featured)
values
  ('a1000000-0000-4000-8000-000000000001', 'Green Leaf NYC', 'green-leaf-nyc',
   'A flagship Manhattan dispensary pairing craft flower with a knowledgeable, welcoming staff. Lab-tested products, fast pickup, and same-day delivery across the five boroughs.',
   '212 Bowery', 'New York', 'NY', '10012', '(212) 555-0142', 'hello@greenleafnyc.example', 'https://greenleafnyc.example',
   null, null,
   'OCM-CAURD-2024-0142', true, true, true, true,
   '{"mon":{"open":"09:00","close":"21:00"},"tue":{"open":"09:00","close":"21:00"},"wed":{"open":"09:00","close":"21:00"},"thu":{"open":"09:00","close":"22:00"},"fri":{"open":"09:00","close":"23:00"},"sat":{"open":"10:00","close":"23:00"},"sun":{"open":"10:00","close":"20:00"}}'::jsonb,
   'SRID=4326;POINT(-73.9919 40.7223)'::geography, 'active', false)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  address = excluded.address,
  city = excluded.city,
  state = excluded.state,
  zip = excluded.zip,
  phone = excluded.phone,
  email = excluded.email,
  website = excluded.website,
  cover_image_url = excluded.cover_image_url,
  license_number = excluded.license_number,
  is_medical = excluded.is_medical,
  is_recreational = excluded.is_recreational,
  is_delivery = excluded.is_delivery,
  is_pickup = excluded.is_pickup,
  hours = excluded.hours,
  location = excluded.location;
  -- NOTE: status & featured intentionally NOT updated here (admin-guard trigger fires on UPDATE).

-- ─── 4. Demo product catalog ─────────────────────────────────────────────────
-- A VALUES list of (dispensary, category, brand, strain) slugs joined to the real
-- rows so FKs resolve regardless of their generated UUIDs. Keyed on (dispensary_id, slug).
insert into public.products
  (dispensary_id, category_id, name, slug, brand, brand_id, description, image_urls,
   strain_type, strain_id, thc_percentage, cbd_percentage, price_cents, weight_grams, unit,
   in_stock, is_featured)
select
  d.id, c.id, v.name, v.slug, b.name, b.id, v.description,
  case when v.img is null then '{}'::text[] else array[v.img]::text[] end,
  v.strain_type::public.strain_type, s.id, v.thc, v.cbd, v.price, v.weight, v.unit,
  v.in_stock, v.featured
from (values
  -- disp_slug, cat_slug, name, slug, brand_slug, strain_slug, description, img, strain_type, thc, cbd, price_cents, weight_g, unit, in_stock, featured
  ('green-leaf-nyc','flower','OG Kush 3.5g','og-kush-3-5g','cookies','og-kush','Earthy, piney classic hybrid with a heavy, relaxing body high. Indoor, hand-trimmed.',null,'hybrid',22.5,0.1,4500,3.5,'eighth',true,true),
  ('green-leaf-nyc','vapes','Blue Dream Live Resin Cart 1g','blue-dream-cart-1g','stiiizy','blue-dream','Sweet berry sativa-leaning hybrid in a full-gram live resin cartridge. Smooth, uplifting daytime vape.',null,'hybrid',85.0,0.5,5000,1,'cartridge',true,true),
  ('green-leaf-nyc','edibles','Wyld Raspberry Gummies 100mg','wyld-raspberry-gummies','wyld',null,'Real-fruit raspberry gummies, 10mg THC each (10-pack). Consistent, fast-acting, vegan.',null,null,null,null,2500,null,'pack',true,false),
  ('green-leaf-nyc','pre-rolls','Sour Diesel Pre-Roll 1g','sour-diesel-preroll-1g','cookies','sour-diesel','Energizing diesel-forward sativa in a tightly packed full-gram cone.',null,'sativa',19.0,0.2,1200,1,'pre-roll',true,false),
  ('green-leaf-nyc','concentrates','Raw Garden GSC Live Resin 1g','rg-gsc-live-resin','raw-garden','girl-scout-cookies','Single-source live resin bursting with cookie terpenes. Dab or top a bowl.',null,'hybrid',78.0,0.3,4000,1,'gram',true,false)
) as v(disp_slug, cat_slug, name, slug, brand_slug, strain_slug, description, img, strain_type, thc, cbd, price, weight, unit, in_stock, featured)
join public.dispensaries d on d.slug = v.disp_slug
join public.categories   c on c.slug = v.cat_slug
left join public.brands  b on b.slug = v.brand_slug
left join public.strains s on s.slug = v.strain_slug
on conflict (dispensary_id, slug) do update set
  category_id    = excluded.category_id,
  name           = excluded.name,
  brand          = excluded.brand,
  brand_id       = excluded.brand_id,
  description    = excluded.description,
  image_urls     = excluded.image_urls,
  strain_type    = excluded.strain_type,
  strain_id      = excluded.strain_id,
  thc_percentage = excluded.thc_percentage,
  cbd_percentage = excluded.cbd_percentage,
  price_cents    = excluded.price_cents,
  weight_grams   = excluded.weight_grams,
  unit           = excluded.unit,
  in_stock       = excluded.in_stock,
  is_featured    = excluded.is_featured;

-- ─── 5. Demo deal ────────────────────────────────────────────────────────────
-- Fixed UUID so re-runs upsert in place. Window: started a week ago, ends in 30 days.
insert into public.deals
  (id, dispensary_id, title, description, discount_type, discount_value, start_date, end_date, is_active)
select v.id::uuid, d.id, v.title, v.description, v.discount_type::public.discount_type, v.discount_value,
       now() - interval '7 days', now() + interval '30 days', true
from (values
  ('d0000000-0000-4000-8000-000000000001','green-leaf-nyc', '20% Off All Flower', 'Stock up — 20% off every flower product, all week long.', 'percentage',20)
) as v(id, disp_slug, title, description, discount_type, discount_value)
join public.dispensaries d on d.slug = v.disp_slug
on conflict (id) do update set
  dispensary_id  = excluded.dispensary_id,
  title          = excluded.title,
  description    = excluded.description,
  discount_type  = excluded.discount_type,
  discount_value = excluded.discount_value,
  start_date     = excluded.start_date,
  end_date       = excluded.end_date,
  is_active      = excluded.is_active;
