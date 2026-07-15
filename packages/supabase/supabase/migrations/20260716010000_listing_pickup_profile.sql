-- ════════════════════════════════════════════════════════════════════════════
-- 20260716010000_listing_pickup_profile
-- Listing-editor parity (roadmap ②), slice 1 — pickup profile:
--   * require_id         — surface "valid ID required" on the storefront
--   * post_order_message — a short note shown to the shopper after they order
-- Additive + backwards-compatible (defaults preserve current behavior).
-- (Mixed adult+medical cart is deferred until products carry a use-type.)
-- ════════════════════════════════════════════════════════════════════════════
set search_path = public;

alter table public.dispensaries
  add column if not exists require_id boolean not null default false,
  add column if not exists post_order_message text;

alter table public.dispensaries drop constraint if exists dispensaries_post_order_message_len;
alter table public.dispensaries
  add constraint dispensaries_post_order_message_len
  check (post_order_message is null or char_length(post_order_message) <= 250);
