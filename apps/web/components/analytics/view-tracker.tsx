'use client';

import { useEffect, useRef } from 'react';
import { track, type AnalyticsEvent } from '@/lib/analytics';

/**
 * Fires a one-shot funnel/engagement event when the surface mounts. Server
 * components (product, strain, search) render this to instrument a "viewed"
 * step without turning the whole page into a client component. The ref guard
 * keeps it to a single capture per mount even under StrictMode double-invoke.
 */
export function ViewTracker({
  event,
  properties,
}: {
  event: AnalyticsEvent;
  properties?: Record<string, unknown>;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(event, properties);
  }, [event, properties]);
  return null;
}
