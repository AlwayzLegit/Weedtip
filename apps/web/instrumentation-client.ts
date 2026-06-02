import * as Sentry from '@sentry/nextjs';

// Browser-side Sentry. No-ops unless NEXT_PUBLIC_SENTRY_DSN is set. Events are
// tunneled through /monitoring (see next.config) so they aren't blocked by CSP
// or ad-blockers.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});

// Instruments App Router client-side navigations for tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
