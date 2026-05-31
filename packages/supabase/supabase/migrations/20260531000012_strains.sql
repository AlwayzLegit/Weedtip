-- ════════════════════════════════════════════════════════════════════════════
-- 20260531000012_strains
-- Strain library (Leafly-style): browsable strains with effects, flavors, and
-- THC range. Products optionally link to a strain so a strain page can show
-- "where to buy" across dispensaries.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

create table public.strains (
  id          uuid primary key default extensions.gen_random_uuid(),
  name        text not null,
  slug        text not null,
  type        public.strain_type not null default 'hybrid',
  description text,
  effects     text[] not null default '{}',
  flavors     text[] not null default '{}',
  thc_low     numeric(5, 2),
  thc_high    numeric(5, 2),
  image_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint strains_slug_key unique (slug),
  constraint strains_name_key unique (name)
);

create index strains_type_idx on public.strains (type);
create index strains_effects_gin on public.strains using gin (effects);

create trigger strains_set_updated_at
  before update on public.strains
  for each row execute function public.set_updated_at();

alter table public.strains enable row level security;

create policy strains_select_public on public.strains
  for select to anon, authenticated using (true);
create policy strains_insert_admin on public.strains
  for insert to authenticated with check (public.is_admin());
create policy strains_update_admin on public.strains
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy strains_delete_admin on public.strains
  for delete to authenticated using (public.is_admin());

-- Link products to a strain (optional).
alter table public.products
  add column strain_id uuid references public.strains (id) on delete set null;
create index products_strain_id_idx on public.products (strain_id);

-- ─── Seed a starter strain library ──────────────────────────────────────────
insert into public.strains (name, slug, type, description, effects, flavors, thc_low, thc_high) values
  ('OG Kush', 'og-kush', 'hybrid',
   'A legendary West Coast hybrid known for its heavy, relaxing body high and earthy, piney aroma.',
   '{Relaxed,Happy,Euphoric,Sleepy}', '{Earthy,Pine,Woody}', 19, 26),
  ('Blue Dream', 'blue-dream', 'hybrid',
   'A sativa-leaning hybrid delivering balanced full-body relaxation with a gentle cerebral lift.',
   '{Happy,Uplifted,Creative,Relaxed}', '{Berry,Blueberry,Sweet}', 17, 24),
  ('Sour Diesel', 'sour-diesel', 'sativa',
   'A fast-acting sativa with energizing, dreamy cerebral effects and a pungent diesel aroma.',
   '{Energetic,Uplifted,Happy,Focused}', '{Diesel,Citrus,Pungent}', 19, 25),
  ('Girl Scout Cookies', 'girl-scout-cookies', 'hybrid',
   'A potent hybrid with euphoric, full-body effects and a sweet, earthy dessert profile.',
   '{Euphoric,Relaxed,Happy,Creative}', '{Sweet,Earthy,Mint}', 22, 28),
  ('Granddaddy Purple', 'granddaddy-purple', 'indica',
   'A classic indica famous for deep relaxation and a sweet grape-and-berry aroma.',
   '{Relaxed,Sleepy,Happy,Hungry}', '{Grape,Berry,Sweet}', 17, 23),
  ('Jack Herer', 'jack-herer', 'sativa',
   'A spicy, pine-scented sativa delivering clear-headed, creative, and blissful effects.',
   '{Creative,Energetic,Uplifted,Focused}', '{Pine,Woody,Spicy}', 18, 24),
  ('Pineapple Express', 'pineapple-express', 'hybrid',
   'A lively hybrid with long-lasting energetic effects and a bright tropical-pineapple flavor.',
   '{Energetic,Happy,Uplifted,Creative}', '{Pineapple,Tropical,Citrus}', 19, 25),
  ('Northern Lights', 'northern-lights', 'indica',
   'One of the most famous indicas — deeply relaxing, with a sweet and spicy earthy aroma.',
   '{Relaxed,Sleepy,Euphoric,Happy}', '{Earthy,Sweet,Pine}', 16, 21)
on conflict (slug) do nothing;
