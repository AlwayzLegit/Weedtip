import * as Sentry from '@sentry/nextjs';

// Browser-side Sentry. No-ops unless NEXT_PUBLIC_SENTRY_DSN is set. Events are
// tunneled through /monitoring (see next.config) so they aren't blocked by CSP
// or ad-blockers.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Known-benign browser/library noise — not actionable, so keep it out of the
  // issue stream where it otherwise escalates into false alarms:
  //  - next-view-transitions aborts its crossfade when a navigation interrupts
  //    an in-flight transition; the navigation still completes. Surfaces as
  //    "Transition was aborted because of timeout/invalid state".
  //  - Supabase's auth client holds its token behind a Navigator LockManager
  //    lock that "immediately fails" harmlessly when multiple tabs contend.
  ignoreErrors: ['Transition was aborted', 'Navigator LockManager'],
});

// Instruments App Router client-side navigations for tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
