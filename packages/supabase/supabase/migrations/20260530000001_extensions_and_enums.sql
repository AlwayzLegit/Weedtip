-- ════════════════════════════════════════════════════════════════════════════
-- 20260530000001_extensions_and_enums
-- Enable required extensions and define the domain enum types.
-- These enum values are the source of truth mirrored in @weedtip/shared/constants.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Extensions (installed into the `extensions` schema per Supabase convention) ──
create schema if not exists extensions;

-- Spatial types and geo queries (geography, ST_DWithin, ST_Distance, …).
create extension if not exists postgis with schema extensions;

-- Trigram matching — powers fuzzy/typo-tolerant text search alongside FTS.
create extension if not exists pg_trgm with schema extensions;

-- gen_random_uuid() and crypto helpers.
create extension if not exists pgcrypto with schema extensions;

-- ─── Enum types ──────────────────────────────────────────────────────────────
create type public.user_role as enum ('consumer', 'dispensary_owner', 'admin');

create type public.dispensary_status as enum ('pending', 'active', 'suspended');

create type public.strain_type as enum ('indica', 'sativa', 'hybrid', 'cbd');

create type public.discount_type as enum ('percentage', 'fixed', 'bogo');

create type public.order_status as enum (
  'pending',
  'confirmed',
  'ready',
  'completed',
  'cancelled'
);

create type public.order_type as enum ('pickup', 'delivery');
