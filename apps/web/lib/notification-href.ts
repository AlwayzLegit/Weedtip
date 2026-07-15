/**
 * Resolves the deep link for a notification from its type + data payload.
 * An explicit `data.href` always wins; otherwise we derive a sensible target
 * per type (so older rows written by DB triggers — which don't set href — still
 * navigate, and owners land on the dashboard order view rather than the consumer
 * one). Returns null only when there's genuinely nowhere useful to go.
 */
export function notificationHref(type: string | null | undefined, data: unknown): string | null {
  const d = (data ?? {}) as {
    href?: string;
    order_id?: string;
    brand_slug?: string;
    dispensary_slug?: string;
    kind?: string;
  };
  if (typeof d.href === 'string' && d.href.length > 0) return d.href;

  switch (type) {
    case 'order_new': // owner-facing new order
      return d.order_id ? `/dashboard/orders/${d.order_id}` : '/dashboard/orders';
    case 'order_update': // buyer-facing status change
    case 'order':
      return d.order_id ? `/orders/${d.order_id}` : '/orders';
    case 'claim': // admin review queue (new ownership claim)
      return d.kind === 'brand' ? '/admin/brands' : '/admin/claims';
    case 'claim_decision':
      return '/dashboard';
    case 'review':
      return '/dashboard/reviews';
    case 'promo':
    case 'billing_update':
      return '/dashboard/promote';
    case 'listing_status':
      return d.dispensary_slug ? `/dispensary/${d.dispensary_slug}` : '/dashboard/listing';
    default:
      return d.order_id ? `/orders/${d.order_id}` : d.brand_slug ? `/brand/${d.brand_slug}` : null;
  }
}
