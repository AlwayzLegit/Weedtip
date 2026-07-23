import { Link } from 'next-view-transitions';
import { BadgeCheck, MapPin, Tag } from 'lucide-react';
import { formatDistance } from '@/lib/format';
import type { DispensaryCardData } from './dispensary-card';
import { MediaImage } from './media-image';
import { OpenNowChip } from './open-now-chip';
import { PlacementBeacon } from './placement-beacon';
import { AdSlotBeacon } from './ads/ad-slot-beacon';
import { RatingStars } from './rating-stars';

/**
 * Google-Maps-style result row for the map browser's list panel: text-forward,
 * single column, small thumbnail on the right, hairline divider between rows.
 * Consumes the same DispensaryCardData as the (vertical) DispensaryCard so the
 * browser can swap one for the other without reshaping its data.
 *
 * The whole row is clickable via a stretched link on the title (valid markup:
 * no nested interactives); `quickActions` renders above that overlay (z-10)
 * for row-level Save / Directions buttons.
 */
export function DispensaryResultRow({
  d,
  quickActions,
}: {
  d: DispensaryCardData;
  quickActions?: React.ReactNode;
}) {
  const distance = formatDistance(d.distanceMeters ?? null);
  const services = [
    ...(d.isPickup ? ['Pickup'] : []),
    ...(d.isDelivery ? ['Delivery'] : []),
    ...(d.isMedical ? ['Medical'] : []),
    ...(d.isRecreational ? ['Rec'] : []),
  ];
  const place = d.city
    ? `${d.city}, ${d.state}`
    : d.county
      ? `${d.county} County`
      : 'Delivery only';

  return (
    <div className="group relative flex gap-3 px-3 py-3">
      {d.placementId && <PlacementBeacon placementId={d.placementId} />}
      {d.adSlot && <AdSlotBeacon slot={d.adSlot} />}

      <div className="min-w-0 flex-1">
        {(d.sponsored || d.featured) && (
          <p className="text-muted mb-0.5 text-[10px] font-semibold uppercase tracking-wide">
            {d.sponsored ? 'Sponsored' : 'Featured'}
          </p>
        )}
        <h3 className="group-hover:text-primary flex items-baseline gap-1.5 font-semibold leading-tight">
          {d.rank != null && <span className="text-muted text-xs font-normal">{d.rank}.</span>}
          <Link
            href={`/dispensary/${d.slug}`}
            prefetch={false}
            className="truncate after:absolute after:inset-0"
          >
            {d.name}
          </Link>
        </h3>

        {/* Rating, or the licensed trust cue when there are no reviews yet. */}
        <div className="mt-0.5 flex min-h-[18px] items-center gap-1.5 text-sm">
          {typeof d.rating === 'number' && d.rating > 0 ? (
            <>
              <span className="font-medium">{d.rating.toFixed(1)}</span>
              <RatingStars rating={d.rating} size={13} />
              {d.reviewCount ? <span className="text-muted text-xs">({d.reviewCount})</span> : null}
            </>
          ) : d.licensed ? (
            <span className="text-primary inline-flex items-center gap-1 text-xs font-medium">
              <BadgeCheck className="h-3.5 w-3.5" /> Licensed
            </span>
          ) : (
            <span className="text-muted text-xs">New listing</span>
          )}
        </div>

        {services.length > 0 && (
          <p className="text-muted mt-0.5 truncate text-xs">{services.join(' · ')}</p>
        )}

        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
          <OpenNowChip
            hours={d.hours}
            timezone={d.timezone}
            openNow={d.openNow}
            className="!bg-transparent !px-0"
          />
          <span className="text-muted inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {place}
            {distance ? ` · ${distance}` : ''}
          </span>
        </p>

        {d.dealBadge && (
          <span className="bg-primary-muted text-primary mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
            <Tag className="h-3 w-3" />
            {d.dealBadge}
          </span>
        )}

        {quickActions && (
          <div className="relative z-10 mt-1.5 flex items-center gap-1.5">{quickActions}</div>
        )}
      </div>

      <MediaImage
        url={d.coverImageUrl}
        fallbackUrl={d.logoUrl}
        alt={d.name}
        className="h-[84px] w-[84px] shrink-0 rounded-lg"
        iconClassName="h-7 w-7"
      />
    </div>
  );
}
