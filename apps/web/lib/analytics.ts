import posthog from 'posthog-js';

/**
 * Funnel + engagement events captured client-side. Keep names stable —
 * PostHog insights and dashboards reference them by string.
 */
export type AnalyticsEvent =
  | 'shop_viewed'
  | 'add_to_cart'
  | 'checkout_started'
  | 'order_placed'
  | 'claim_started'
  | 'claim_submitted';

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
