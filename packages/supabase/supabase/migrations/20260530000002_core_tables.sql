-- ════════════════════════════════════════════════════════════════════════════
-- 20260530000002_core_tables
-- Core schema for the Weedtip marketplace. Tables only — indexes (0003),
-- functions/triggers (0004), search (0005), and RLS (0006) follow.
--
-- Make PostGIS types/functions resolve unqualified within this migration.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

-- ─── profiles ────────────────────────────────────────────────────────────────
-- Extends Supabase auth.users 1:1. A row is auto-created on signup (see 0004).
-- `date_of_birth` backs the 21+ age gate (compliance). `role` is admin-managed;
-- self role escalation is blocked by a trigger in 0004.
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          public.user_role not null default 'consumer',
  display_name  text,
  avatar_url    text,
  date_of_birth date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profiles_display_name_len check (display_name is null or char_length(display_name) <= 80),
  -- Lower bound only: an immutable sanity check. "Not in the future" is validated
  -- app-side (Zod) since CURRENT_DATE is non-immutable and unfit for a CHECK.
  constraint profiles_dob_realistic check (date_of_birth is null or date_of_birth > '1900-01-01')
);

comment on table public.profiles is 'User profile extending auth.users 1:1. Holds role and age-gate DOB.';

-- ─── dispensaries ────────────────────────────────────────────────────────────
create table public.dispensaries (
  id              uuid primary key default extensions.gen_random_uuid(),
  owner_id        uuid references public.profiles (id) on delete set null,
  name            text not null,
  slug            text not null,
  description     text,
  address         text not null,
  city            text not null,
  state           char(2) not null,
  zip             text not null,
  phone           text,
  email           text,
  website         text,
  logo_url        text,
  cover_image_url text,
  license_number  text,
  is_medical      boolean not null default false,
  is_recreational boolean not null default true,
  is_delivery     boolean not null default false,
  is_pickup       boolean not null default true,
  hours           jsonb,
  location        geography(Point, 4326) not null,
  status          public.dispensary_status not null default 'pending',
  featured        boolean not null default false,
  -- Full-text search vector (weighted: name > city > description).
  search_vector   tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A')
    || setweight(to_tsvector('english', coalesce(city, '')), 'B')
    || setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint dispensaries_slug_key unique (slug),
  constraint dispensaries_name_len check (char_length(name) between 2 and 120),
  constraint dispensaries_zip_format check (zip ~ '^\d{5}(-\d{4})?$')
);

comment on column public.dispensaries.location is 'WGS84 point. All geo logic uses PostGIS; the frontend renders via Mapbox.';
comment on column public.dispensaries.hours is 'JSONB: { mon: {open,close}|null, …, sun: … } in 24h "HH:mm". See @weedtip/shared operatingHoursSchema.';

-- ─── categories ──────────────────────────────────────────────────────────────
create table public.categories (
  id         uuid primary key default extensions.gen_random_uuid(),
  name       text not null,
  slug       text not null,
  icon       text,
  sort_order integer not null default 0,
  constraint categories_slug_key unique (slug),
  constraint categories_name_key unique (name)
);

comment on table public.categories is 'Product taxonomy (Flower, Vapes, Edibles, …). Seeded in seed.sql.';

-- ─── products ────────────────────────────────────────────────────────────────
create table public.products (
  id             uuid primary key default extensions.gen_random_uuid(),
  dispensary_id  uuid not null references public.dispensaries (id) on delete cascade,
  category_id    uuid not null references public.categories (id) on delete restrict,
  name           text not null,
  slug           text not null,
  brand          text,
  description    text,
  image_urls     text[] not null default '{}',
  strain_type    public.strain_type,
  thc_percentage numeric(5, 2),
  cbd_percentage numeric(5, 2),
  price_cents    integer not null,
  weight_grams   numeric(10, 3),
  unit           text,
  in_stock       boolean not null default true,
  is_featured    boolean not null default false,
  search_vector  tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A')
    || setweight(to_tsvector('english', coalesce(brand, '')), 'B')
    || setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint products_dispensary_slug_key unique (dispensary_id, slug),
  constraint products_price_nonneg check (price_cents >= 0),
  constraint products_thc_range check (thc_percentage is null or thc_percentage between 0 and 100),
  constraint products_cbd_range check (cbd_percentage is null or cbd_percentage between 0 and 100),
  constraint products_weight_pos check (weight_grams is null or weight_grams > 0)
);

-- ─── deals ───────────────────────────────────────────────────────────────────
create table public.deals (
  id             uuid primary key default extensions.gen_random_uuid(),
  dispensary_id  uuid not null references public.dispensaries (id) on delete cascade,
  title          text not null,
  description    text,
  discount_type  public.discount_type not null,
  discount_value numeric(10, 2) not null,
  start_date     timestamptz not null,
  end_date       timestamptz not null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint deals_value_nonneg check (discount_value >= 0),
  constraint deals_pct_max check (discount_type <> 'percentage' or discount_value <= 100),
  constraint deals_date_order check (end_date > start_date)
);

-- ─── reviews ─────────────────────────────────────────────────────────────────
-- One review per user per dispensary.
create table public.reviews (
  id            uuid primary key default extensions.gen_random_uuid(),
  dispensary_id uuid not null references public.dispensaries (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  rating        smallint not null,
  body          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint reviews_user_dispensary_key unique (dispensary_id, user_id),
  constraint reviews_rating_range check (rating between 1 and 5),
  constraint reviews_body_len check (body is null or char_length(body) <= 4000)
);

-- ─── favorites ───────────────────────────────────────────────────────────────
create table public.favorites (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  dispensary_id uuid not null references public.dispensaries (id) on delete cascade,
  created_at    timestamptz not null default now(),
  constraint favorites_pkey primary key (user_id, dispensary_id)
);

-- ─── orders ──────────────────────────────────────────────────────────────────
-- `items` is a JSONB snapshot of the cart at order time (name + price captured so
-- historical orders are stable even if the product later changes). Money in cents.
create table public.orders (
  id             uuid primary key default extensions.gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete restrict,
  dispensary_id  uuid not null references public.dispensaries (id) on delete restrict,
  status         public.order_status not null default 'pending',
  order_type     public.order_type not null,
  items          jsonb not null,
  subtotal_cents integer not null default 0,
  tax_cents      integer not null default 0,
  total_cents    integer not null default 0,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint orders_items_nonempty check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  constraint orders_money_nonneg check (subtotal_cents >= 0 and tax_cents >= 0 and total_cents >= 0)
);

-- ─── operating_regions ───────────────────────────────────────────────────────
-- Regional legality + minimum age, keyed by 2-letter state code. Drives
-- compliance gating (legality checks + age) per the data model, not bolted on.
create table public.operating_regions (
  state                 char(2) primary key,
  is_medical_legal      boolean not null default false,
  is_recreational_legal boolean not null default false,
  min_age               smallint not null default 21,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint operating_regions_min_age check (min_age between 18 and 25)
);
