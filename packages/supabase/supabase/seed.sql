-- ════════════════════════════════════════════════════════════════════════════
-- seed.sql — reference data applied after migrations on `supabase db reset`.
-- Idempotent: safe to re-run. Contains NO user/PII data.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Product categories (mirror @weedtip/shared PRODUCT_CATEGORIES) ──────────
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

-- ─── Operating regions (legality + min age) ──────────────────────────────────
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
