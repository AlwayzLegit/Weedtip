-- ════════════════════════════════════════════════════════════════════════════
-- 20260719150000_out_for_delivery_status
-- Delivery logistics v1 (part 1/2): the out_for_delivery order status.
-- Added alone — a new enum value cannot be referenced in the same transaction.
-- ════════════════════════════════════════════════════════════════════════════
alter type public.order_status add value if not exists 'out_for_delivery' after 'ready';
