-- ════════════════════════════════════════════════════════════════════════════
-- seed.sql — reference + demo data applied after migrations on `supabase db reset`.
-- Idempotent: safe to re-run. Contains NO user/PII data.
--
-- Sections:
--   1. Product categories            (reference)
--   2. Operating regions             (reference / compliance)
--   3. Demo dispensaries             (8 directory listings, owner_id null)
--   4. Demo product catalog          (~40 products wired to strains/brands/categories)
--   5. Demo deals                    (promotions on featured shops)
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

-- ─── 3. Demo dispensaries ────────────────────────────────────────────────────
-- 8 directory listings across recreational-legal states. owner_id is null (these are
-- public marketplace listings; the owner-claim flow attaches a real owner later).
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
   'SRID=4326;POINT(-73.9919 40.7223)'::geography, 'active', false),

  ('a1000000-0000-4000-8000-000000000002', 'Sunset Dispensary LA', 'sunset-la',
   'Sunset Strip''s neighborhood cannabis shop. Premium California flower, concentrates, and a deep edibles selection with daily delivery across West LA.',
   '8201 Sunset Blvd', 'Los Angeles', 'CA', '90046', '(323) 555-0188', 'team@sunsetla.example', 'https://sunsetla.example',
   null, null,
   'C10-0000188-LIC', true, true, true, true,
   '{"mon":{"open":"08:00","close":"22:00"},"tue":{"open":"08:00","close":"22:00"},"wed":{"open":"08:00","close":"22:00"},"thu":{"open":"08:00","close":"22:00"},"fri":{"open":"08:00","close":"00:00"},"sat":{"open":"08:00","close":"00:00"},"sun":{"open":"09:00","close":"22:00"}}'::jsonb,
   'SRID=4326;POINT(-118.3712 34.0979)'::geography, 'active', false),

  ('a1000000-0000-4000-8000-000000000003', 'Emerald Collective SF', 'emerald-collective',
   'A worker-owned collective in the Mission serving sustainably grown, small-batch cannabis. Curated menu, fair pricing, and expert budtenders.',
   '2140 Mission St', 'San Francisco', 'CA', '94110', '(415) 555-0119', 'hi@emeraldsf.example', 'https://emeraldsf.example',
   null, null,
   'C10-0000119-LIC', true, true, true, true,
   '{"mon":{"open":"10:00","close":"21:00"},"tue":{"open":"10:00","close":"21:00"},"wed":{"open":"10:00","close":"21:00"},"thu":{"open":"10:00","close":"21:00"},"fri":{"open":"10:00","close":"22:00"},"sat":{"open":"10:00","close":"22:00"},"sun":{"open":"11:00","close":"20:00"}}'::jsonb,
   'SRID=4326;POINT(-122.4194 37.7631)'::geography, 'active', true),

  ('a1000000-0000-4000-8000-000000000004', 'Mile High Dispensary', 'mile-high-denver',
   'Denver''s go-to for value ounces and premium concentrates since legalization. Recreational and medical menus, plus rotating daily deals.',
   '1555 Blake St', 'Denver', 'CO', '80202', '(303) 555-0166', 'shop@milehighco.example', 'https://milehighco.example',
   null, null,
   'CO-RMR-0166', true, true, false, true,
   '{"mon":{"open":"08:00","close":"22:00"},"tue":{"open":"08:00","close":"22:00"},"wed":{"open":"08:00","close":"22:00"},"thu":{"open":"08:00","close":"22:00"},"fri":{"open":"08:00","close":"23:00"},"sat":{"open":"08:00","close":"23:00"},"sun":{"open":"09:00","close":"21:00"}}'::jsonb,
   'SRID=4326;POINT(-104.9990 39.7505)'::geography, 'active', true),

  ('a1000000-0000-4000-8000-000000000005', 'Rose City Cannabis', 'rose-city-cannabis',
   'Portland''s craft cannabis destination. Locally sourced sungrown flower, live resin, and a famously friendly staff in the heart of the Pearl District.',
   '1314 NW Glisan St', 'Portland', 'OR', '97209', '(503) 555-0173', 'info@rosecitycannabis.example', 'https://rosecitycannabis.example',
   null, null,
   'OLCC-073', false, true, true, true,
   '{"mon":{"open":"09:00","close":"22:00"},"tue":{"open":"09:00","close":"22:00"},"wed":{"open":"09:00","close":"22:00"},"thu":{"open":"09:00","close":"22:00"},"fri":{"open":"09:00","close":"23:00"},"sat":{"open":"09:00","close":"23:00"},"sun":{"open":"10:00","close":"21:00"}}'::jsonb,
   'SRID=4326;POINT(-122.6841 45.5266)'::geography, 'active', true),

  ('a1000000-0000-4000-8000-000000000006', 'Desert Bloom', 'desert-bloom-phoenix',
   'Phoenix''s premier medical and recreational dispensary. Climate-controlled flower, top-shelf vapes, and free parking with express pickup.',
   '4041 N Central Ave', 'Phoenix', 'AZ', '85012', '(602) 555-0151', 'contact@desertbloomaz.example', 'https://desertbloomaz.example',
   null, null,
   'AZ-DHS-0151', true, true, false, true,
   '{"mon":{"open":"08:00","close":"22:00"},"tue":{"open":"08:00","close":"22:00"},"wed":{"open":"08:00","close":"22:00"},"thu":{"open":"08:00","close":"22:00"},"fri":{"open":"08:00","close":"22:00"},"sat":{"open":"08:00","close":"22:00"},"sun":{"open":"08:00","close":"22:00"}}'::jsonb,
   'SRID=4326;POINT(-112.0738 33.4942)'::geography, 'active', true),

  ('a1000000-0000-4000-8000-000000000007', 'Bay State Wellness', 'bay-state-wellness',
   'Boston''s trusted medical and adult-use dispensary. Compliance-first, patient-focused, with a calm retail experience and a robust concentrate menu.',
   '401 Park Dr', 'Boston', 'MA', '02215', '(617) 555-0134', 'care@baystatewellness.example', 'https://baystatewellness.example',
   null, null,
   'MA-CCC-0134', true, true, false, true,
   '{"mon":{"open":"10:00","close":"20:00"},"tue":{"open":"10:00","close":"20:00"},"wed":{"open":"10:00","close":"20:00"},"thu":{"open":"10:00","close":"21:00"},"fri":{"open":"10:00","close":"21:00"},"sat":{"open":"10:00","close":"21:00"},"sun":null}'::jsonb,
   'SRID=4326;POINT(-71.0982 42.3447)'::geography, 'active', false),

  ('a1000000-0000-4000-8000-000000000008', 'Silver State Cannabis', 'silver-state-vegas',
   'Just off the Las Vegas Strip — tourist-friendly, open late, with a huge selection of flower, vapes, and edibles. Recreational welcome, no medical card required.',
   '4503 Paradise Rd', 'Las Vegas', 'NV', '89169', '(702) 555-0177', 'vegas@silverstatecannabis.example', 'https://silverstatecannabis.example',
   null, null,
   'NV-CCB-0177', true, true, true, true,
   '{"mon":{"open":"00:00","close":"00:00"},"tue":{"open":"00:00","close":"00:00"},"wed":{"open":"00:00","close":"00:00"},"thu":{"open":"00:00","close":"00:00"},"fri":{"open":"00:00","close":"00:00"},"sat":{"open":"00:00","close":"00:00"},"sun":{"open":"00:00","close":"00:00"}}'::jsonb,
   'SRID=4326;POINT(-115.1537 36.1158)'::geography, 'active', true)
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
  ('green-leaf-nyc','concentrates','Raw Garden GSC Live Resin 1g','rg-gsc-live-resin','raw-garden','girl-scout-cookies','Single-source live resin bursting with cookie terpenes. Dab or top a bowl.',null,'hybrid',78.0,0.3,4000,1,'gram',true,false),

  ('sunset-la','flower','Granddaddy Purple 3.5g','gdp-3-5g','cookies','granddaddy-purple','Deep purple indica with grape and berry notes. Heavy, sedating evening flower.',null,'indica',24.0,0.1,4200,3.5,'eighth',true,true),
  ('sunset-la','flower','Jack Herer 3.5g','jack-herer-3-5g','cookies','jack-herer','Spicy, pine-forward sativa. Clear-headed and creative — a daytime staple.',null,'sativa',21.0,0.2,4000,3.5,'eighth',true,false),
  ('sunset-la','vapes','Stiiizy Pineapple Express Pod 0.95g','stiiizy-pineapple-pod','stiiizy','pineapple-express','Tropical hybrid pod for the Stiiizy battery. Sweet pineapple, smooth pulls.',null,'hybrid',88.0,0.4,4500,0.95,'pod',true,true),
  ('sunset-la','edibles','Kiva Dark Chocolate Bar 100mg','kiva-dark-choc-bar','kiva',null,'Belgian dark chocolate, 5mg THC per square (20 squares). Smooth, dependable dose.',null,null,null,null,2200,null,'bar',true,false),
  ('sunset-la','topicals','CBD Relief Balm 500mg','cbd-relief-balm','wyld',null,'Cooling menthol + CBD balm for targeted muscle and joint relief. Non-psychoactive.',null,'cbd',0.5,5.0,3500,null,'jar',true,false),

  ('emerald-collective','flower','Northern Lights 3.5g','northern-lights-3-5g','cookies','northern-lights','Legendary resinous indica. Sweet and spicy with a deeply calming finish.',null,'indica',20.0,0.3,3800,3.5,'eighth',true,true),
  ('emerald-collective','vapes','Raw Garden Sour Diesel Cart 1g','rg-sour-diesel-cart','raw-garden','sour-diesel','Pungent diesel sativa in a clean, single-source live resin cart.',null,'sativa',82.0,0.2,4800,1,'cartridge',true,false),
  ('emerald-collective','concentrates','GSC Live Rosin 1g','gsc-live-rosin','raw-garden','girl-scout-cookies','Solventless live rosin pressed from fresh-frozen flower. Connoisseur-grade.',null,'hybrid',80.0,0.2,6000,1,'gram',true,true),
  ('emerald-collective','edibles','Wyld Elderberry Gummies 100mg','wyld-elderberry-gummies','wyld',null,'Indica-enhanced elderberry gummies, 10mg THC each. Great for winding down.',null,null,null,null,2500,null,'pack',true,false),
  ('emerald-collective','pre-rolls','Blue Dream Pre-Roll 5-Pack','blue-dream-preroll-5pk','cookies','blue-dream','Five half-gram cones of crowd-pleasing Blue Dream. Perfect for sharing.',null,'hybrid',18.0,0.2,3500,2.5,'pack',true,false),

  ('mile-high-denver','flower','OG Kush 7g','og-kush-7g','cookies','og-kush','Quarter-ounce of classic OG Kush at a Colorado value price. Earthy and potent.',null,'hybrid',23.0,0.1,7000,7,'quarter',true,true),
  ('mile-high-denver','flower','Pineapple Express 3.5g','pineapple-express-3-5g','cookies','pineapple-express','Tropical, energetic hybrid. Sweet pineapple nose with a happy, social high.',null,'hybrid',21.0,0.2,3600,3.5,'eighth',true,false),
  ('mile-high-denver','vapes','Stiiizy OG Kush Pod 0.95g','stiiizy-og-pod','stiiizy','og-kush','Heavy-hitting OG Kush pod. Earthy, relaxing, and famously smooth.',null,'hybrid',87.0,0.3,4500,0.95,'pod',true,false),
  ('mile-high-denver','tinctures','Full-Spectrum CBD Tincture 1000mg','cbd-tincture-1000','wyld',null,'1000mg full-spectrum CBD in MCT oil. Precise sublingual dosing, lab-tested.',null,'cbd',1.0,20.0,4000,null,'bottle',true,false),
  ('mile-high-denver','edibles','Kiva Camino Wild Berry Gummies','kiva-camino-gummies','kiva',null,'Sativa-forward wild berry gummies, 5mg THC each. Uplifting and bright.',null,null,null,null,2300,null,'pack',true,true),

  ('rose-city-cannabis','flower','Sour Diesel 3.5g','sour-diesel-3-5g','cookies','sour-diesel','Sungrown Oregon Sour Diesel. Loud diesel aroma, fast-acting cerebral lift.',null,'sativa',22.0,0.2,3200,3.5,'eighth',true,true),
  ('rose-city-cannabis','flower','Girl Scout Cookies 3.5g','gsc-3-5g','cookies','girl-scout-cookies','Dessert-sweet hybrid with a euphoric, full-body high. Frosty and aromatic.',null,'hybrid',24.0,0.1,3800,3.5,'eighth',true,false),
  ('rose-city-cannabis','concentrates','Raw Garden Jack Herer Shatter 1g','rg-jack-shatter','raw-garden','jack-herer','Glassy, stable shatter with bright sativa terpenes. Snaps clean.',null,'sativa',75.0,0.2,3000,1,'gram',true,false),
  ('rose-city-cannabis','vapes','Blue Dream Cart 0.5g','blue-dream-cart-half','stiiizy','blue-dream','Half-gram Blue Dream cartridge — a perfect on-the-go sampler.',null,'hybrid',84.0,0.4,3000,0.5,'cartridge',true,false),
  ('rose-city-cannabis','edibles','Wyld Pear Gummies 100mg','wyld-pear-gummies','wyld',null,'Sparkling pear gummies enhanced with CBG, 10mg THC each. Balanced and bright.',null,null,null,null,2400,null,'pack',true,false),

  ('desert-bloom-phoenix','flower','Granddaddy Purple 3.5g','gdp-3-5g','cookies','granddaddy-purple','Desert-grown GDP. Grape-forward indica for deep evening relaxation.',null,'indica',23.0,0.1,4000,3.5,'eighth',true,true),
  ('desert-bloom-phoenix','vapes','Raw Garden Pineapple Express Cart 1g','rg-pineapple-cart','raw-garden','pineapple-express','Tropical hybrid live resin cart. Bright, juicy, and smooth.',null,'hybrid',83.0,0.3,4600,1,'cartridge',true,false),
  ('desert-bloom-phoenix','pre-rolls','Northern Lights Pre-Roll 1g','nl-preroll-1g','cookies','northern-lights','Full-gram indica cone. Sweet, earthy, and deeply mellow.',null,'indica',19.0,0.2,1300,1,'pre-roll',true,false),
  ('desert-bloom-phoenix','edibles','Kiva Milk Chocolate Bar 100mg','kiva-milk-choc-bar','kiva',null,'Creamy milk chocolate, 5mg THC per square (20 squares). A fan favorite.',null,null,null,null,2200,null,'bar',true,false),
  ('desert-bloom-phoenix','topicals','Cooling CBD Sport Gel 750mg','cooling-cbd-gel','wyld',null,'Fast-absorbing CBD sport gel with arnica and menthol. Post-workout relief.',null,'cbd',0.3,8.0,3200,null,'jar',true,false),

  ('bay-state-wellness','flower','Jack Herer 3.5g','jack-herer-3-5g','cookies','jack-herer','New England favorite. Crisp, piney sativa with a focused, functional high.',null,'sativa',20.0,0.2,4400,3.5,'eighth',true,true),
  ('bay-state-wellness','flower','OG Kush 3.5g','og-kush-3-5g','cookies','og-kush','Top-shelf OG Kush, hand-trimmed and cured for 3 weeks. Classic and reliable.',null,'hybrid',22.0,0.1,4500,3.5,'eighth',true,false),
  ('bay-state-wellness','vapes','Stiiizy Granddaddy Purple Pod 0.95g','stiiizy-gdp-pod','stiiizy','granddaddy-purple','Rich, grape-forward indica pod. Heavy and relaxing — best after dark.',null,'indica',86.0,0.3,4700,0.95,'pod',true,false),
  ('bay-state-wellness','concentrates','Raw Garden Sour Diesel Resin Sauce 1g','rg-resin-sauce','raw-garden','sour-diesel','Terpene-rich live resin sauce. Bright diesel nose, big flavor.',null,'sativa',79.0,0.2,4200,1,'gram',true,true),
  ('bay-state-wellness','edibles','Wyld Huckleberry Gummies 100mg','wyld-huckleberry-gummies','wyld',null,'Pacific Northwest huckleberry gummies, 10mg THC each. Hybrid effect.',null,null,null,null,2600,null,'pack',true,false),

  ('silver-state-vegas','flower','Blue Dream 3.5g','blue-dream-3-5g','cookies','blue-dream','Vegas''s best-seller. Sweet berry hybrid with a balanced, mellow high.',null,'hybrid',21.0,0.2,4000,3.5,'eighth',true,true),
  ('silver-state-vegas','flower','Sour Diesel 7g','sour-diesel-7g','cookies','sour-diesel','Quarter-ounce of energizing Sour Diesel. Big value, loud terps.',null,'sativa',22.0,0.2,7500,7,'quarter',true,false),
  ('silver-state-vegas','vapes','Stiiizy Jack Herer Pod 0.95g','stiiizy-jack-pod','stiiizy','jack-herer','Bright, piney sativa pod. Clear-headed and uplifting for daytime.',null,'sativa',88.0,0.3,4500,0.95,'pod',true,true),
  ('silver-state-vegas','edibles','Kiva Terra Bites Blueberry 100mg','kiva-terra-bites','kiva',null,'Dark-chocolate-covered blueberries, 5mg THC each. Poppable and precise.',null,null,null,null,2400,null,'pack',true,false),
  ('silver-state-vegas','accessories','Borosilicate Glass Spoon Pipe','glass-spoon-pipe',null,null,'Hand-blown 4" borosilicate spoon pipe with a deep bowl and carb. Colors vary.',null,null,null,null,2500,null,'each',true,false)
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

-- ─── 5. Demo deals ───────────────────────────────────────────────────────────
-- Fixed UUIDs so re-runs upsert in place. Window: started a week ago, ends in 30 days.
insert into public.deals
  (id, dispensary_id, title, description, discount_type, discount_value, start_date, end_date, is_active)
select v.id::uuid, d.id, v.title, v.description, v.discount_type::public.discount_type, v.discount_value,
       now() - interval '7 days', now() + interval '30 days', true
from (values
  ('d0000000-0000-4000-8000-000000000001','green-leaf-nyc',     '20% Off All Flower',            'Stock up — 20% off every flower product, all week long.',                 'percentage',20),
  ('d0000000-0000-4000-8000-000000000002','sunset-la',          'Pre-Roll BOGO',                 'Buy any pre-roll, get one of equal or lesser value free.',                'bogo',      1),
  ('d0000000-0000-4000-8000-000000000003','emerald-collective', '$10 Off Orders Over $50',       'Take $10 off when your cart hits $50 or more. Members and first-timers.',  'fixed',     1000),
  ('d0000000-0000-4000-8000-000000000004','mile-high-denver',   '15% Off All Vapes',             'Every cartridge and pod, 15% off. Mix and match.',                        'percentage',15),
  ('d0000000-0000-4000-8000-000000000005','rose-city-cannabis', 'Weekend Special: 25% Off Edibles','Gummies, chocolates, and more — 25% off Friday through Sunday.',         'percentage',25),
  ('d0000000-0000-4000-8000-000000000006','silver-state-vegas', 'First-Time Customer 30% Off',   'New here? Show ID at pickup and take 30% off your first order.',          'percentage',30)
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
