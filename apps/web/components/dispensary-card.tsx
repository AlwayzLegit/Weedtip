import { Link } from 'next-view-transitions';
import { BadgeCheck, MapPin, Tag, Truck, Store } from 'lucide-react';
import type { OperatingHours } from '@weedtip/shared';
import { formatDistance } from '@/lib/format';
import { Badge } from './ui/badge';
import { LogoImage } from './logo-image';
import { MediaImage } from './media-image';
import { AdSlotBeacon, type AdSlotMeta } from './ads/ad-slot-beacon';
import { OpenNowChip } from './open-now-chip';
import { PlacementBeacon } from './placement-beacon';
import { RatingStars } from './rating-stars';

export interface DispensaryCardData {
  slug: string;
  name: string;
  city: string | null;
  state: string;
  /** Service-area county for delivery-only listings without a city. */
  county?: string | null;
  coverImageUrl: string | null;
  logoUrl?: string | null;
  isDelivery: boolean;
  isPickup: boolean;
  isMedical: boolean;
  isRecreational: boolean;
  featured?: boolean;
  sponsored?: boolean;
  /** When set, records placement impression/click analytics for this card. */
  placementId?: string;
  /** When set, this card is a paid regional ad slot — fires ad_impression/ad_click. */
  adSlot?: AdSlotMeta;
  distanceMeters?: number | null;
  rating?: number | null;
  reviewCount?: number;
  /** State cannabis license on file — the strongest trust signal we can show. */
  licensed?: boolean;
  /** Server-computed open state (search RPCs); omit (or null) when unknown. */
  openNow?: boolean | null;
  /**
   * When provided, the Open/Closed chip is computed live client-side in the
   * shop's own timezone (correct even on ISR-cached pages).
   */
  hours?: OperatingHours | null;
  timezone?: string | null;
  /** Short active-deal label, e.g. "20% off" or "BOGO". */
  dealBadge?: string | null;
}

export function DispensaryCard({ d }: { d: DispensaryCardData }) {
  const distance = formatDistance(d.distanceMeters ?? null);
  // Best-of style trust signal: highly rated with enough reviews to be credible.
  const topRated = (d.rating ?? 0) >= 4.5 && (d.reviewCount ?? 0) >= 10;

  // Service tags in priority order; the card shows at most three on one row.
  const serviceBadges: { label: string; icon?: React.ReactNode }[] = [
    ...(d.isPickup ? [{ label: 'Pickup', icon: <Store className="h-3 w-3" /> }] : []),
    ...(d.isDelivery ? [{ label: 'Delivery', icon: <Truck className="h-3 w-3" /> }] : []),
    ...(d.isMedical ? [{ label: 'Medical' }] : []),
    ...(d.isRecreational ? [{ label: 'Rec' }] : []),
  ];

  return (
    <Link
      href={`/dispensary/${d.slug}`}
      prefetch={false}
      className="rounded-card border-border bg-surface shadow-card hover:border-primary/50 hover:shadow-card-hover group flex h-full flex-col overflow-hidden border transition-all duration-200 hover:-translate-y-0.5"
    >
      {d.placementId && <PlacementBeacon placementId={d.placementId} />}
      {d.adSlot && <AdSlotBeacon slot={d.adSlot} />}
      <MediaImage url={d.coverImageUrl} alt={d.name} className="h-36" iconClassName="h-12 w-12">
        {d.sponsored ? (
          <Badge tone="primary" className="absolute left-3 top-3">
            Sponsored
          </Badge>
        ) : (
          d.featured && (
            <Badge tone="primary" className="absolute left-3 top-3">
              Featured
            </Badge>
          )
        )}
        {distance && (
          <Badge className="bg-background/80 absolute right-3 top-3">
            <MapPin className="h-3 w-3" />
            {distance}
          </Badge>
        )}
        <OpenNowChip
          hours={d.hours}
          timezone={d.timezone}
          openNow={d.openNow}
          className="absolute bottom-3 left-3"
        />
        {d.dealBadge && (
          <Badge tone="primary" className="absolute bottom-3 right-3">
            <Tag className="h-3 w-3" />
            {d.dealBadge}
          </Badge>
        )}
      </MediaImage>

      <div className="flex-1 space-y-2 p-4">
        <div className="flex items-center gap-2">
          <LogoImage src={d.logoUrl} name={d.name} className="h-8 w-8" />
          <h3 className="group-hover:text-primary truncate font-semibold">{d.name}</h3>
        </div>
        <p className="text-muted text-sm">
          {d.city
            ? `${d.city}, ${d.state}`
            : d.county
              ? `Delivery · ${d.county} County`
              : 'Delivery only'}
        </p>

        {/* Rating row is always present so every card in a row shares the same
            vertical rhythm. Nearly every shop is pre-reviews, so the unrated
            state leads with the licensed trust cue instead of an apologetic
            "no reviews yet" — the license on file is the credible signal. */}
        <div className="flex min-h-[20px] items-center gap-1.5">
          {typeof d.rating === 'number' && d.rating > 0 ? (
            <>
              <RatingStars rating={d.rating} />
              <span className="text-muted text-xs">
                {d.rating.toFixed(1)}
                {d.reviewCount ? ` (${d.reviewCount})` : ''}
              </span>
              {topRated && (
                <Badge tone="primary" className="ml-0.5">
                  Top Rated
                </Badge>
              )}
            </>
          ) : d.licensed ? (
            <span className="text-primary inline-flex items-center gap-1 text-xs font-medium">
              <BadgeCheck className="h-3.5 w-3.5" />
              Licensed
            </span>
          ) : (
            <span className="text-muted text-xs">New listing</span>
          )}
        </div>

        {/* One non-wrapping row — capped so 4 services never spill to a second
            line and clip against the card's bottom edge. */}
        <div className="flex gap-1.5 overflow-hidden pt-1">
          {serviceBadges.slice(0, 3).map((b) => (
            <Badge key={b.label} tone="outline" className="shrink-0">
              {b.icon}
              {b.label}
            </Badge>
          ))}
        </div>
      </div>
    </Link>
  );
}
