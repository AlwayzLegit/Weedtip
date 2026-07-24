import { displayRating, type RatedShopFields } from './google-rating';

/**
 * Transparent, defensible ranking for "Best of" directory pages.
 *
 * The core is a Bayesian-adjusted rating (a.k.a. the IMDb/"true Bayesian
 * estimate"): a shop with 200 reviews at 4.6 should outrank one with a single
 * 5.0, because one review is not evidence of being the best in town. Every
 * rating is pulled toward a prior mean with a fixed pseudo-count of reviews, so
 * confidence — not just the raw average — decides the order.
 */

/** Pseudo-reviews of prior belief. Higher = more skeptical of thin review counts. */
const PRIOR_WEIGHT = 8;

/** Fallback prior mean when a market has too few ratings to compute its own. */
const DEFAULT_PRIOR_MEAN = 4.2;

export type Rankable = RatedShopFields & {
  rating_avg: number;
  rating_count: number;
  featured?: boolean;
  cover_image_url?: string | null;
  license_number?: string | null;
  hours?: unknown;
};

/**
 * The rating a shop is ranked on, with its provenance. Weedtip's own reviews
 * win when they exist; otherwise a FRESH Google rating stands in, so a market
 * can be ranked before it has grown first-party reviews. A stale Google rating
 * counts as no rating at all — see lib/google-rating.ts.
 *
 * Pages that rank on this must say so: the number a shopper sees and the number
 * we sorted by have to come from the same, named source.
 */
export function rankingRating(s: Rankable): { rating: number; count: number } | null {
  const shown = displayRating(s);
  return shown ? { rating: shown.rating, count: shown.count } : null;
}

/**
 * Bayesian-adjusted rating. `mean` is the prior the estimate regresses toward —
 * pass the market's own mean so a strong local field isn't dragged down by a
 * national prior, falling back to DEFAULT_PRIOR_MEAN.
 */
export function bayesianScore(
  ratingAvg: number,
  ratingCount: number,
  mean: number = DEFAULT_PRIOR_MEAN,
  weight: number = PRIOR_WEIGHT,
): number {
  const v = Math.max(0, ratingCount);
  return (v * ratingAvg + weight * mean) / (v + weight);
}

/** The mean rating across rated shops — the prior a market regresses toward. */
export function marketMean(shops: Rankable[]): number {
  const rated = shops.flatMap((s) => {
    const r = rankingRating(s);
    return r ? [r] : [];
  });
  if (rated.length === 0) return DEFAULT_PRIOR_MEAN;
  return rated.reduce((sum, r) => sum + r.rating, 0) / rated.length;
}

/**
 * Profile completeness (0..1): a mild tie-breaker so a fully-built listing edges
 * out an identical-scoring bare one. Never overrides the rating signal.
 */
export function completeness(s: Rankable): number {
  let filled = 0;
  const total = 3;
  if (s.cover_image_url) filled += 1;
  if (s.license_number) filled += 1;
  if (s.hours != null) filled += 1;
  return filled / total;
}

/**
 * Rank shops best-first: Bayesian rating, then raw review volume, then profile
 * completeness, then editorial `featured`, then name for a stable order. Returns
 * a new array; does not mutate the input.
 */
export function rankDispensaries<T extends Rankable & { name: string }>(shops: T[]): T[] {
  const mean = marketMean(shops);
  const scoreOf = (s: T) => {
    const r = rankingRating(s);
    return r ? bayesianScore(r.rating, r.count, mean) : -1;
  };
  const countOf = (s: T) => rankingRating(s)?.count ?? 0;
  return [...shops].sort((a, b) => {
    const sa = scoreOf(a);
    const sb = scoreOf(b);
    if (Math.abs(sa - sb) > 1e-6) return sb - sa;
    if (countOf(a) !== countOf(b)) return countOf(b) - countOf(a);
    const ca = completeness(a);
    const cb = completeness(b);
    if (Math.abs(ca - cb) > 1e-6) return cb - ca;
    if (!!a.featured !== !!b.featured) return Number(b.featured) - Number(a.featured);
    return a.name.localeCompare(b.name);
  });
}
