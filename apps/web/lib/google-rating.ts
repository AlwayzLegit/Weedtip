/**
 * Reading Google ratings safely and honestly.
 *
 * Two rules this module exists to enforce:
 *
 *  1. FRESHNESS — Google Maps Platform permits only temporary caching of Places
 *     content, so a cached rating older than the TTL is treated as absent
 *     everywhere: not shown, not ranked on. The backfill re-fetches it.
 *  2. PROVENANCE — a rating is never shown without saying where it came from.
 *     Weedtip's own reviews and Google's ratings stay in separate columns; this
 *     picks which to display and always reports the source alongside it, so the
 *     UI cannot accidentally present Google's number as our own.
 *
 * Weedtip reviews win when they exist: they're first-party, verifiable, and the
 * thing we actually want shops to earn.
 */

/**
 * How long a cached Google rating may be shown before it must be re-fetched.
 * Single source of truth: the admin backfill imports this to build its refresh
 * queue, and the read path below treats anything older as absent.
 */
export const GOOGLE_RATING_TTL_DAYS = 30;

const TTL_MS = GOOGLE_RATING_TTL_DAYS * 24 * 60 * 60 * 1000;

export type RatingSource = 'weedtip' | 'google';

export type RatedShopFields = {
  rating_avg?: number | null;
  rating_count?: number | null;
  google_rating?: number | null;
  google_rating_count?: number | null;
  google_rating_at?: string | null;
  google_maps_uri?: string | null;
};

export type DisplayRating = {
  rating: number;
  count: number;
  source: RatingSource;
  /** Google Maps listing to attribute/link to — only set for Google ratings. */
  sourceUrl: string | null;
};

/** Is a cached Google rating still inside the permitted caching window? */
export function googleRatingIsFresh(at: string | null | undefined): boolean {
  if (!at) return false;
  const ts = new Date(at).getTime();
  return Number.isFinite(ts) && Date.now() - ts < TTL_MS;
}

/**
 * The rating to show for a listing, with its provenance — or null when there's
 * nothing honest to show. Weedtip reviews take precedence; a stale Google
 * rating counts as no rating at all.
 */
export function displayRating(shop: RatedShopFields): DisplayRating | null {
  if ((shop.rating_count ?? 0) > 0 && (shop.rating_avg ?? 0) > 0) {
    return {
      rating: shop.rating_avg as number,
      count: shop.rating_count as number,
      source: 'weedtip',
      sourceUrl: null,
    };
  }
  if (
    (shop.google_rating ?? 0) > 0 &&
    (shop.google_rating_count ?? 0) > 0 &&
    googleRatingIsFresh(shop.google_rating_at)
  ) {
    return {
      rating: shop.google_rating as number,
      count: shop.google_rating_count as number,
      source: 'google',
      sourceUrl: shop.google_maps_uri ?? null,
    };
  }
  return null;
}

/**
 * PostgREST column fragment for everything `displayRating` reads from Google.
 * Append to a dispensary select so a surface can show an attributed rating.
 */
export const GOOGLE_RATING_COLUMNS =
  'google_rating,google_rating_count,google_rating_at,google_maps_uri';

/**
 * Rating props for a DispensaryCard, with provenance. Returns an unrated card
 * (which falls back to the licensed/new-listing cue) when there's nothing
 * honest to show.
 */
export function cardRatingProps(shop: RatedShopFields): {
  rating: number | null;
  reviewCount: number;
  ratingSource?: RatingSource;
} {
  const shown = displayRating(shop);
  if (!shown) return { rating: null, reviewCount: 0 };
  return { rating: shown.rating, reviewCount: shown.count, ratingSource: shown.source };
}

/**
 * Same, for the map browser's shop shape — it carries a plain number, where 0
 * means unrated and the card falls back to its Licensed / New listing cue.
 */
export function browserRatingProps(shop: RatedShopFields): {
  rating: number;
  reviewCount: number;
  ratingSource?: RatingSource;
} {
  const p = cardRatingProps(shop);
  return { rating: p.rating ?? 0, reviewCount: p.reviewCount, ratingSource: p.ratingSource };
}

/**
 * Narrows the `rating_source` text the search RPCs return. Anything unexpected
 * (or null, meaning unrated) becomes undefined rather than a bogus label.
 */
export function ratingSourceOf(value: string | null | undefined): RatingSource | undefined {
  return value === 'google' || value === 'weedtip' ? value : undefined;
}

/** Short, honest attribution label for a rating's source. */
export function ratingSourceLabel(source: RatingSource): string {
  return source === 'google' ? 'Rating from Google' : 'Weedtip reviews';
}

/**
 * Names the rating sources actually behind a ranked list, for on-page copy.
 * A page that ranks partly on Google data can't call itself "ranked by verified
 * customer reviews", so the sentence is built from the real mix instead.
 */
export function sourceMixPhrase(sources: { weedtip: number; google: number }): string {
  if (sources.weedtip > 0 && sources.google > 0) return 'customer ratings from Weedtip and Google';
  if (sources.google > 0) return 'customer ratings from Google';
  return 'verified Weedtip reviews';
}
