'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { Suspense, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

/**
 * Wraps the app in PostHog analytics. Inert (renders children only) unless
 * NEXT_PUBLIC_POSTHOG_KEY is set, so the build and local dev work without it.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!KEY || typeof window === 'undefined') return;
    posthog.init(KEY, {
      api_host: HOST,
      capture_pageview: false, // captured manually on route change below
      capture_pageleave: true,
      // Collect real Core Web Vitals (LCP/CLS/INP/FCP/TTFB) from field traffic
      // so performance work can target actual offenders instead of lab guesses.
      capture_performance: { web_vitals: true },
      person_profiles: 'identified_only',
    });
  }, []);

  if (!KEY) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      <IdentityTracker />
      {children}
    </PHProvider>
  );
}

/**
 * Ties PostHog identity to the Supabase session so journeys stitch across
 * anonymous → signed-in (user id + role, never PII beyond email). Reset on
 * sign-out starts a fresh anonymous person.
 */
function IdentityTracker() {
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) posthog.identify(user.id, { email: user.email });
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        posthog.identify(session.user.id, { email: session.user.email });
      } else if (event === 'SIGNED_OUT') {
        posthog.reset();
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  return null;
}

/** Emits a $pageview on App Router client navigations. */
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    let url = window.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
