import { cache } from 'react';
import { rankDispensaries, marketMean } from '@/lib/ranking';
import { citySlug, US_STATES } from '@/lib/seo';
import { createStaticClient } from '@/lib/supabase/static';
import { fetchAll } from '@/lib/supabase/fetch-all';

/** A market needs at least this many rated shops for a credible "best" ranking. */
export const MIN_RATED = 3;

/** How many shops a ranked list shows. */
export const TOP_N = 10;

export type BestOfShop = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string;
  cover_image_url: string | null;
  logo_url: string | null;
  is_delivery: boolean;
  is_pickup: boolean;
  is_medical: boolean;
  is_recreational: boolean;
  featured: boolean;
  rating_avg: number;
  rating_count: number;
  hours: unknown;
  timezone: string | null;
  license_number: string | null;
};

export type BestOfResult = {
  stateName: string;
  cityName: string;
  ranked: BestOfShop[];
  mean: number;
  ratedCount: number;
  /** Total shops in scope for this city (all shops, or delivery-only shops). */
  totalInScope: number;
};

const SELECT =
  'id,slug,name,city,state,cover_image_url,logo_url,is_delivery,is_pickup,is_medical,is_recreational,featured,rating_avg,rating_count,hours,timezone,license_number';

/**
 * Shared loader for the "Best of" ranked pages (dispensaries + delivery). The
 * third arg is a primitive so React's `cache` memoizes correctly across the
 * generateMetadata + page render for the same request. Returns null when the
 * state is unknown or the market has too few rated shops to rank credibly —
 * both the page (notFound) and the sitemap (skip URL) honor that same gate.
 */
export const loadBestOf = cache(async function loadBestOf(
  state: string,
  city: string,
  deliveryOnly: boolean,
): Promise<BestOfResult | null> {
  const code = state.toUpperCase();
  const stateName = US_STATES[code];
  if (!stateName) return null;
  const supabase = createStaticClient();
  const rows = await fetchAll<BestOfShop>((from, to) =>
    supabase
      .from('dispensaries')
      .select(SELECT)
      .eq('status', 'active')
      .eq('state', code)
      .order('name')
      .range(from, to),
  );
  let inScope = rows.filter((s) => citySlug(s.city ?? '') === city.toLowerCase());
  const cityName = inScope[0]?.city ?? '';
  if (deliveryOnly) inScope = inScope.filter((s) => s.is_delivery);
  if (inScope.length === 0) return null;

  // Only rated shops can be credibly "the best" — an unreviewed shop isn't
  // evidence of quality. Gate the page on a real field of contenders.
  const rated = inScope.filter((s) => s.rating_count > 0);
  if (rated.length < MIN_RATED) return null;

  return {
    stateName,
    cityName,
    ranked: rankDispensaries(rated).slice(0, TOP_N),
    mean: marketMean(rated),
    ratedCount: rated.length,
    totalInScope: inScope.length,
  };
});
