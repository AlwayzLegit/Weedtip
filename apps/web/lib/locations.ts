import { unstable_cache } from 'next/cache';
import { US_STATES } from '@/lib/seo';
import { createStaticClient } from '@/lib/supabase/static';

export type StateListingCount = {
  /** Two-letter USPS code, e.g. "CA". */
  code: string;
  /** Full state name, e.g. "California". */
  name: string;
  /** Active listing count in the state. */
  count: number;
};

/**
 * Active dispensary count per state, most first — the data behind the
 * /dispensaries/locations index and the footer "browse by state" rail. Cached
 * hourly (aggregate over public active listings) so it's cheap enough to render
 * in the sitewide footer. States without a known code are dropped.
 */
export const activeStateCounts = unstable_cache(
  async (): Promise<StateListingCount[]> => {
    const supabase = createStaticClient();
    const { data } = await supabase.rpc('state_listing_counts');
    return (data ?? [])
      .map((r) => ({ code: r.state, name: US_STATES[r.state], count: Number(r.count) }))
      .filter((r): r is StateListingCount => Boolean(r.name));
  },
  ['active-state-counts'],
  { revalidate: 3600 },
);
