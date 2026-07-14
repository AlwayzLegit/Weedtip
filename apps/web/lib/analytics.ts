import posthog from 'posthog-js';

/**
 * Funnel + engagement events captured client-side. Keep names stable —
 * PostHog insights and dashboards reference them by string.
 */
export type AnalyticsEvent =
  // Shopper journey
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
  // Business journey (claim → monetize)
  | 'claim_started'
  | 'claim_submitted'
  | 'advertise_viewed'
  | 'advertise_region_viewed'
  | 'plan_change_requested'
  | 'placement_requested'
  | 'brand_promo_requested'
  | 'brand_bid_requested'
  | 'ad_slot_requested'
  // Ad delivery
  | 'ad_impression'
  | 'ad_click';

/**
 * Safe wrapper around posthog.capture: no-ops on the server and when PostHog
 * isn't configured (NEXT_PUBLIC_POSTHOG_KEY unset), so callers never guard.
 * Pass `beacon: true` when the capture races a full-page navigation
 * so the event survives page unload (e.g. right before navigation).
 */
export function track(
  event: AnalyticsEvent,
  properties?: Record<string, unknown>,
  options?: { beacon?: boolean },
) {
  if (typeof window === 'undefined' || !posthog.__loaded) return;
  posthog.capture(event, properties, options?.beacon ? { transport: 'sendBeacon' } : undefined);
}
