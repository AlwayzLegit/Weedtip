'use client';

import { useEffect, useState } from 'react';
import { Link } from 'next-view-transitions';
import { ArrowRight, MapPin } from 'lucide-react';
import { US_STATES } from '@/lib/seo';
import { readMarketCookie } from './market-selector';

/**
 * On nationwide surfaces, nudge the shopper toward their own market. Reads the
 * market cookie client-side after hydration so the page HTML itself stays
 * statically cached and shared across visitors.
 */
export function MarketBanner({
  hrefPrefix,
  label,
}: {
  /** State-scoped path prefix, e.g. "/deals" → /deals/ca or "/dispensaries". */
  hrefPrefix: string;
  /** What lives there, e.g. "deals" or "dispensaries". */
  label: string;
}) {
  const [state, setState] = useState<string | null>(null);
  useEffect(() => {
    setState(readMarketCookie());
  }, []);

  if (!state) return null;
  return (
    <Link
      href={`${hrefPrefix}/${state.toLowerCase()}`}
      className="border-primary/30 bg-primary-muted text-primary hover:border-primary/60 mt-4 flex items-center justify-between gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
    >
      <span className="flex items-center gap-2">
        <MapPin className="h-4 w-4" />
        You&apos;re browsing nationwide — see {label} in {US_STATES[state]}
      </span>
      <ArrowRight className="h-4 w-4 shrink-0" />
    </Link>
  );
}
