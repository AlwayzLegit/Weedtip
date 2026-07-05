-- 20260705100000_menu_sources
-- POS menu sync, phase 1: feed connections + idempotent product imports.
--
-- A dispensary connects ONE menu feed (a hosted JSON array or CSV — the
-- lowest common denominator every POS can export; dutchie/jane provider
-- values are reserved for native integrations later). The sync engine
-- upserts products by (dispensary_id, external_id) so re-syncs update in
-- place, and marks feed-managed items that disappear from the feed as out
-- of stock rather than deleting them (order history references them).

create table public.menu_sources (
  id             uuid primary key default extensions.gen_random_uuid(),
  dispensary_id  uuid not null references public.dispensaries (id) on delete cascade,
  provider       text not null default 'generic_json',
  feed_url       text not null,
  auto_sync      boolean not null default true,
  status         text not null default 'idle',
  last_synced_at timestamptz,
  last_error     text,
  items_imported integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint menu_sources_dispensary_key unique (dispensary_id),
  constraint menu_sources_provider_check check (provider in ('generic_json', 'csv_url', 'dutchie', 'jane')),
  constraint menu_sources_status_check check (status in ('idle', 'syncing', 'ok', 'error')),
  constraint menu_sources_feed_url_check check (feed_url ~* '^https://')
);

comment on table public.menu_sources is 'One menu feed per dispensary (hosted JSON/CSV). The sync engine + daily cron keep the menu in step with the shop''s POS export.';

-- Feed-managed products carry the POS item id for idempotent upserts.
-- Plain UNIQUE (NULLS DISTINCT) so hand-managed rows (NULL external_id)
-- are unaffected and PostgREST upserts can target the constraint.
alter table public.products add column if not exists external_id text;
alter table public.products
  add constraint products_dispensary_external_key unique (dispensary_id, external_id);

comment on column public.products.external_id is 'POS/feed item id for menu-sync upserts; NULL for hand-managed products.';

-- ─── RLS: owners manage their own source; admins everything ─────────────────
alter table public.menu_sources enable row level security;

create policy "menu_sources_owner_select" on public.menu_sources
  for select using (public.owns_dispensary(dispensary_id) or public.is_admin());
create policy "menu_sources_owner_insert" on public.menu_sources
  for insert with check (public.owns_dispensary(dispensary_id) or public.is_admin());
create policy "menu_sources_owner_update" on public.menu_sources
  for update using (public.owns_dispensary(dispensary_id) or public.is_admin());
create policy "menu_sources_owner_delete" on public.menu_sources
  for delete using (public.owns_dispensary(dispensary_id) or public.is_admin());
