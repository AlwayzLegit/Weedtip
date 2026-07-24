import { cache } from 'react';
import { displayRating } from '@/lib/google-rating';
import { rankDispensaries, marketMean, rankingRating } from '@/lib/ranking';
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
  google_rating: number | null;
  google_rating_count: number | null;
  google_rating_at: string | null;
  google_maps_uri: string | null;
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
  /** How many of the ranked shops are scored on Weedtip vs Google ratings —
   *  the page states its own mix rather than claiming one blanket source. */
  sources: { weedtip: number; google: number };
  /** Total shops in scope for this city (all shops, or delivery-only shops). */
  totalInScope: number;
};

const SELECT =
  'id,slug,name,city,state,cover_image_url,logo_url,is_delivery,is_pickup,is_medical,is_recreational,featured,rating_avg,rating_count,google_rating,google_rating_count,google_rating_at,google_maps_uri,hours,timezone,license_number';

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
  // evidence of quality. A shop counts as rated when it has Weedtip reviews OR
  // a fresh Google rating (see lib/google-rating.ts); ranking and the on-page
  // copy both name whichever source is actually used.
  const rated = inScope.filter((s) => rankingRating(s) !== null);
  if (rated.length < MIN_RATED) return null;

  const ranked = rankDispensaries(rated).slice(0, TOP_N);
  const sources = ranked.reduce(
    (acc, s) => {
      const shown = displayRating(s);
      if (shown?.source === 'google') acc.google += 1;
      else if (shown?.source === 'weedtip') acc.weedtip += 1;
      return acc;
    },
    { weedtip: 0, google: 0 },
  );

  return {
    stateName,
    cityName,
    ranked,
    mean: marketMean(rated),
    ratedCount: rated.length,
    sources,
    totalInScope: inScope.length,
  };
});

/** One city that qualifies for a "Best of" ranking (≥ MIN_RATED rated shops). */
export type BestOfMarket = {
  state: string;
  stateName: string;
  city: string;
  citySlug: string;
  ratedCount: number;
  /** Whether this city also has enough rated *delivering* shops for a delivery ranking. */
  hasDelivery: boolean;
};

/**
 * Every city with a credible ranking, for the index hub. Groups active shops by
 * city, keeps those with ≥ MIN_RATED rated shops, and flags delivery depth —
 * mirroring the per-page and sitemap gates so the hub never links to a 404.
 */
export const loadBestOfMarkets = cache(async function loadBestOfMarkets(): Promise<BestOfMarket[]> {
  const supabase = createStaticClient();
  const rows = await fetchAll<{
    city: string | null;
    state: string;
    rating_avg: number;
    rating_count: number;
    google_rating: number | null;
    google_rating_count: number | null;
    google_rating_at: string | null;
    is_delivery: boolean;
  }>((from, to) =>
    supabase
      .from('dispensaries')
      .select(
        'city, state, rating_avg, rating_count, google_rating, google_rating_count, google_rating_at, is_delivery',
      )
      .eq('status', 'active')
      .range(from, to),
  );

  const agg = new Map<
    string,
    { state: string; city: string; rated: number; deliveryRated: number }
  >();
  for (const r of rows) {
    if (!r.city || !US_STATES[r.state.toUpperCase()]) continue;
    const key = `${r.state.toUpperCase()}/${citySlug(r.city)}`;
    const cur = agg.get(key) ?? {
      state: r.state.toUpperCase(),
      city: r.city,
      rated: 0,
      deliveryRated: 0,
    };
    // Same "is this shop rated?" rule as the pages: Weedtip reviews, or a
    // Google rating still inside the caching window.
    if (rankingRating({ ...r, rating_avg: r.rating_avg ?? 0, rating_count: r.rating_count ?? 0 })) {
      cur.rated += 1;
      if (r.is_delivery) cur.deliveryRated += 1;
    }
    agg.set(key, cur);
  }

  return [...agg.values()]
    .filter((m) => m.rated >= MIN_RATED)
    .map((m) => ({
      state: m.state,
      stateName: US_STATES[m.state]!,
      city: m.city,
      citySlug: citySlug(m.city),
      ratedCount: m.rated,
      hasDelivery: m.deliveryRated >= MIN_RATED,
    }))
    .sort((a, b) => a.stateName.localeCompare(b.stateName) || a.city.localeCompare(b.city));
});
