-- ════════════════════════════════════════════════════════════════════════════
-- 20260602000022_specials_engine_schema
-- Evolves the flat `deals` row into a Weedmaps-style specials engine: richer
-- special types, item/category/brand targeting, day/time scheduling, eligibility
-- rules (customer type, order type, spend, redemption caps, stacking) and
-- presentation (image, terms, featured, sort priority). Behavior is unchanged
-- until the discount engine migration wires these in — every new column defaults
-- to the current behavior.
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

-- Richer special-type taxonomy. Kept alongside legacy discount_type; the engine reads `kind`.
create type public.deal_kind as enum (
  'percentage','fixed_amount','price_target','bogo','bundle','gift','spend_threshold'
);

create type public.deal_target_scope as enum ('menu','category','brand','products');

alter table public.deals
  add column kind public.deal_kind not null default 'percentage',
  -- type-specific values
  add column min_subtotal_cents integer,      -- spend threshold / min spend to qualify
  add column max_discount_cents integer,        -- cap on total discount
  add column buy_quantity integer,              -- bogo/bundle: qty to buy
  add column get_quantity integer,              -- bogo/bundle/gift: qty discounted/free
  add column get_discount_percent numeric,      -- bogo: 100 = free, 50 = half off
  -- targeting
  add column target_scope public.deal_target_scope not null default 'menu',
  add column target_category_ids uuid[] not null default '{}',
  add column target_brand_ids uuid[] not null default '{}',
  add column target_product_ids uuid[] not null default '{}',
  add column exclude_product_ids uuid[] not null default '{}',
  -- scheduling (within start_date..end_date)
  add column days_of_week smallint[] not null default '{}', -- empty = all; 0=Sun..6=Sat
  add column time_start time,
  add column time_end time,
  -- eligibility
  add column auto_apply boolean not null default false,
  add column new_customers_only boolean not null default false,
  add column order_types public.order_type[] not null default '{}', -- empty = all
  add column per_customer_limit integer,
  add column total_limit integer,
  add column stackable boolean not null default false,
  -- presentation
  add column image_url text,
  add column terms text,
  add column featured boolean not null default false,
  add column sort_priority integer not null default 0;

-- Backfill the new taxonomy from the legacy discount_type.
update public.deals set kind = case discount_type
  when 'percentage' then 'percentage'::public.deal_kind
  when 'fixed' then 'fixed_amount'::public.deal_kind
  when 'bogo' then 'bogo'::public.deal_kind
  else 'percentage'::public.deal_kind
end;
