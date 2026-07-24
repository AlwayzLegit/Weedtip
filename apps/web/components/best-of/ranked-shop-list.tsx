import { Link } from 'next-view-transitions';
import { BadgeCheck, MapPin, Store, Truck } from 'lucide-react';
import type { OperatingHours } from '@weedtip/shared';
import { MediaImage } from '@/components/media-image';
import { OpenNowChip } from '@/components/open-now-chip';
import { RatingStars } from '@/components/rating-stars';
import { Badge } from '@/components/ui/badge';
import { bayesianScore, rankingRating, type Rankable } from '@/lib/ranking';
import { displayRating } from '@/lib/google-rating';
import type { BestOfShop } from '@/lib/best-of';

/**
 * The ranked `<ol>` shared by every "Best of" page: a numbered list of shops
 * with per-row rationale (rating, review count, licensing, fulfillment,
 * open-now) and the computed score. `mean` is the market prior the score
 * regresses toward; `topLabel` names the #1 badge ("Top rated").
 */
export function RankedShopList({
  shops,
  mean,
  topLabel = 'Top rated',
}: {
  shops: BestOfShop[];
  mean: number;
  topLabel?: string;
}) {
  return (
    <ol className="mt-8 space-y-4">
      {shops.map((s, i) => {
        const shown = displayRating(s);
        const ranked = rankingRating(s);
        const score = ranked ? bayesianScore(ranked.rating, ranked.count, mean) : 0;
        return (
          <li key={s.id}>
            <Link
              href={`/dispensary/${s.slug}`}
              className="rounded-card border-border bg-surface hover:border-primary/50 hover:shadow-card-hover focus-visible:ring-primary group flex gap-4 border p-4 transition-all focus-visible:outline-none focus-visible:ring-2 sm:p-5"
            >
              <div className="flex flex-col items-center gap-1 pt-1">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold ${
                    i === 0
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-2 text-muted border-border border'
                  }`}
                  aria-hidden
                >
                  {i + 1}
                </span>
              </div>
              <MediaImage
                url={s.cover_image_url ?? s.logo_url}
                alt={s.name}
                artSeed={s.slug}
                className="hidden h-20 w-28 shrink-0 rounded-lg sm:block"
                iconClassName="h-7 w-7"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="group-hover:text-primary text-lg font-semibold transition-colors">
                    <span className="sr-only">{`#${i + 1}: `}</span>
                    {s.name}
                  </h2>
                  {i === 0 && (
                    <Badge tone="primary" className="shrink-0">
                      {topLabel}
                    </Badge>
                  )}
                  {s.license_number && (
                    <span className="text-muted inline-flex items-center gap-1 text-xs">
                      <BadgeCheck className="text-primary h-3.5 w-3.5" /> Licensed
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  {shown && (
                    <>
                      <RatingStars rating={shown.rating} />
                      <span className="font-semibold">{shown.rating.toFixed(1)}</span>
                      <span className="text-muted">
                        ({shown.count.toLocaleString()} {shown.count === 1 ? 'review' : 'reviews'})
                      </span>
                      {/* Provenance travels with the number, always. */}
                      <span className="text-muted text-xs">
                        {shown.source === 'google' ? 'on Google' : 'on Weedtip'}
                      </span>
                    </>
                  )}
                  <OpenNowChip hours={s.hours as OperatingHours | null} timezone={s.timezone} />
                </div>
                <div className="text-muted mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {s.city && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {s.city}, {s.state}
                    </span>
                  )}
                  {s.is_pickup && (
                    <span className="inline-flex items-center gap-1">
                      <Store className="h-3 w-3" /> Pickup
                    </span>
                  )}
                  {s.is_delivery && (
                    <span className="inline-flex items-center gap-1">
                      <Truck className="h-3 w-3" /> Delivery
                    </span>
                  )}
                  <span className="ml-auto tabular-nums">Score {score.toFixed(2)}</span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

// Re-exported so callers importing the list also get the score type if needed.
export type { Rankable };
