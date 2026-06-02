import { withSentryConfig } from '@sentry/nextjs';

// Content Security Policy. Scoped to the origins the app actually talks to:
// Supabase (REST/Realtime/Storage), Mapbox (tiles/GL worker), Stripe (Checkout),
// and PostHog (analytics). Sentry events are tunneled same-origin via /monitoring.
// 'unsafe-inline' is retained for scripts/styles because Next's runtime injects inline
// bootstrap/styles; tightening to nonces is a follow-up once verified against the live app.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://api.mapbox.com https://us-assets.i.posthog.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.mapbox.com https://api.mapbox.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://us.i.posthog.com https://us-assets.i.posthog.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), payment=(self), geolocation=(self), interest-cohort=()',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile workspace packages so their TS source is compiled by Next.
  transpilePackages: ['@weedtip/shared', '@weedtip/supabase'],
  // Lint runs as its own Turborepo task (root flat config); don't re-run during build.
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      // Supabase Storage public buckets (avatars, dispensary-media, product-images).
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withSentryConfig(nextConfig, {
  org: 'weed-tip',
  project: 'weedtip-web',
  // Quiet build logs; source-map upload runs only when SENTRY_AUTH_TOKEN is set.
  silent: true,
  // Route browser events through a same-origin path so CSP/ad-blockers don't drop them.
  tunnelRoute: '/monitoring',
  disableLogger: true,
});
