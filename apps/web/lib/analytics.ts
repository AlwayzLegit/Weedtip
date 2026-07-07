import posthog from 'posthog-js';

/**
 * Funnel + engagement events captured client-side. Keep names stable —
 * PostHog insights and dashboards reference them by string.
 */
export type AnalyticsEvent =
  | 'search_performed'
  | 'shop_viewed'
  | 'product_viewed'
  | 'strain_viewed'
  | 'add_to_cart'
  | 'checkout_started'
  | 'order_placed'
  | 'favorite_added'
  | 'favorite_removed'
  | 'deal_alert_subscribed'
  | 'claim_started'
  | 'claim_submitted'
  | 'ad_impression'
  | 'ad_click';

/**
 * Safe wrapper around posthog.capture: no-ops on the server and when PostHog
 * isn't configured (NEXT_PUBLIC_POSTHOG_KEY unset), so callers never guard.
 * Pass `beacon: true` when the capture races a full-page navigation
 * (e.g. the Stripe redirect) so the event survives page unload.
 */
export function track(
  event: AnalyticsEvent,
  properties?: Record<string, unknown>,
  options?: { beacon?: boolean },
) {
  if (typeof window === 'undefined' || !posthog.__loaded) return;
  posthog.capture(event, properties, options?.beacon ? { transport: 'sendBeacon' } : undefined);
}
