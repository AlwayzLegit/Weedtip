-- ════════════════════════════════════════════════════════════════════════════
-- 20260715160000_accepting_orders
--
-- A per-dispensary "accepting online orders" switch so a shop can pause incoming
-- online orders (slammed, closed early, out of stock) without hiding its listing.
-- Enforced in the checkout action; the storefront + dashboard read it too.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.dispensaries
  add column if not exists accepting_orders boolean not null default true;
