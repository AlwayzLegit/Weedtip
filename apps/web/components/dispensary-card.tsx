import Link from 'next/link';
import { MapPin, Truck, Store } from 'lucide-react';
import { formatDistance } from '@/lib/format';
import { Badge } from './ui/badge';
import { MediaImage } from './media-image';
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
  distanceMeters?: number | null;
  rating?: number | null;
  reviewCount?: number;
}

export function DispensaryCard({ d }: { d: DispensaryCardData }) {
  const distance = formatDistance(d.distanceMeters ?? null);
  // Best-of style trust signal: highly rated with enough reviews to be credible.
  const topRated = (d.rating ?? 0) >= 4.5 && (d.reviewCount ?? 0) >= 10;

  return (
    <Link
      href={`/dispensary/${d.slug}`}
      className="rounded-card border-border bg-surface shadow-card hover:border-primary/50 hover:shadow-card-hover group block overflow-hidden border transition-all duration-200 hover:-translate-y-0.5"
    >
      {d.placementId && <PlacementBeacon placementId={d.placementId} />}
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
      </MediaImage>

      <div className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          {d.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={d.logoUrl}
              alt=""
              className="border-border bg-surface h-8 w-8 shrink-0 rounded-md border object-contain p-0.5"
            />
          )}
          <h3 className="group-hover:text-primary truncate font-semibold">{d.name}</h3>
        </div>
        <p className="text-muted text-sm">
          {d.city
            ? `${d.city}, ${d.state}`
            : d.county
              ? `Delivery · ${d.county} County`
              : 'Delivery only'}
        </p>

        {typeof d.rating === 'number' && d.rating > 0 && (
          <div className="flex items-center gap-1.5">
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
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 pt-1">
          {d.isPickup && (
            <Badge tone="outline">
              <Store className="h-3 w-3" /> Pickup
            </Badge>
          )}
          {d.isDelivery && (
            <Badge tone="outline">
              <Truck className="h-3 w-3" /> Delivery
            </Badge>
          )}
          {d.isMedical && <Badge tone="outline">Medical</Badge>}
          {d.isRecreational && <Badge tone="outline">Rec</Badge>}
        </div>
      </div>
    </Link>
  );
}
