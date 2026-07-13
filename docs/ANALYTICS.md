# Analytics & monitoring

## Stack

- **PostHog** (`NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`) —
  product analytics: pageviews (manual on route change), pageleave, Core Web
  Vitals, the typed event contract below, and identity stitching
  (`posthog.identify` on Supabase sign-in, `reset` on sign-out;
  `person_profiles: 'identified_only'`).
- **Sentry** (`NEXT_PUBLIC_SENTRY_DSN`, build uploads via
  `SENTRY_AUTH_TOKEN`) — errors + traces on client, server, and edge, RSC
  request errors via `onRequestError`, events tunneled same-origin at
  `/monitoring` so ad-blockers don't drop them.
- **First-party ad events** (Supabase `record_ad_event` /
  `record_placement_event`) — searches/impressions/clicks per region, zone,
  and placement. These bill/price the ad system and feed the admin
  occupancy/demand dashboards; they are intentionally separate from PostHog.

Both PostHog and Sentry are inert without their env keys — set them in Vercel
(the integrations create most of them; ensure the `NEXT_PUBLIC_` variants
exist since client code can only read those).

## Event contract (lib/analytics.ts — names are API, don't rename)

**Shopper journey**
`search_performed` → `shop_viewed` / `product_viewed` / `strain_viewed` →
`add_to_cart` → `checkout_started` → `order_placed`
(plus `favorite_added/removed`, `deal_alert_subscribed`)

**Business journey**
`claim_started` → `claim_submitted`;
`advertise_viewed` → `advertise_region_viewed` →
`ad_slot_requested` / `placement_requested` / `plan_change_requested` /
`brand_promo_requested` / `brand_bid_requested`

**Ad delivery** — `ad_impression`, `ad_click` (also mirrored first-party).

## Funnels to build in PostHog (exact event names)

1. **Shopper conversion:** search_performed → shop_viewed → add_to_cart →
   checkout_started → order_placed. Breakdown: `order_type`, `device`.
2. **Menu-to-order per shop:** shop_viewed → add_to_cart → order_placed,
   breakdown by `dispensary_slug` — this is the stat sales quotes to
   prospects ("X visits became Y orders on your free listing").
3. **Advertiser acquisition:** advertise_viewed → advertise_region_viewed →
   ad_slot_requested. Breakdown: `tier`, `region_slug`.
4. **Claim funnel:** shop_viewed → claim_started → claim_submitted.
5. **Upgrade funnel:** identified dispensary owners: `$pageview`
   (/dashboard/promote) → plan_change_requested.

Dashboards worth pinning: Web Vitals (built-in), Paths from `$pageview` for
traffic flow, Retention on `order_placed` (weekly), and a Trends board with
`order_placed`, `claim_submitted`, and the five `*_requested` events —
that's the revenue pipeline at a glance.
