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

/** Mirrors GOOGLE_RATING_TTL_DAYS in the enrichment action. */
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

/** Short, honest attribution label for a rating's source. */
export function ratingSourceLabel(source: RatingSource): string {
  return source === 'google' ? 'Rating from Google' : 'Weedtip reviews';
}
