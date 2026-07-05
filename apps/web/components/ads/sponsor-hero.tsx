import Link from 'next/link';
import { Crown, MapPin, Store, Truck } from 'lucide-react';
import { Badge } from '../ui/badge';
import { LogoImage } from '../logo-image';
import { MediaImage } from '../media-image';
import { RatingStars } from '../rating-stars';
import { AdSlotBeacon } from './ad-slot-beacon';

export interface SponsorHeroData {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string;
  coverImageUrl: string | null;
  logoUrl?: string | null;
  rating?: number | null;
  reviewCount?: number;
  isDelivery: boolean;
  isPickup: boolean;
}

/**
 * The exclusive Regional Sponsor unit: one dispensary pinned above ALL results
 * in every zone of its region. Visibly labeled (FTC compliance) and tracked
 * with ad_impression / ad_click PostHog events.
 */
export function SponsorHero({
  d,
  regionSlug,
  regionName,
  zoneSlug,
}: {
  d: SponsorHeroData;
  regionSlug: string;
  regionName: string;
  zoneSlug: string | null;
}) {
  return (
    <Link
      href={`/dispensary/${d.slug}`}
      prefetch={false}
      className="rounded-card border-primary/40 bg-surface shadow-card hover:shadow-card-hover group relative block overflow-hidden border-2 transition-all duration-200 hover:-translate-y-0.5"
    >
      <AdSlotBeacon
        slot={{ slotType: 'exclusive', regionSlug, zoneSlug, dispensaryId: d.id }}
      />
      <div className="flex flex-col sm:flex-row">
        <MediaImage
          url={d.coverImageUrl}
          alt={d.name}
          className="h-40 sm:h-auto sm:w-2/5"
          iconClassName="h-12 w-12"
        >
          <Badge tone="primary" className="absolute left-3 top-3">
            <Crown className="h-3 w-3" /> Regional Sponsor
          </Badge>
        </MediaImage>
        <div className="flex-1 space-y-2 p-5">
          <div className="flex items-center gap-3">
            <LogoImage src={d.logoUrl} name={d.name} className="h-10 w-10" />
            <div className="min-w-0">
              <h2 className="group-hover:text-primary truncate text-lg font-bold">{d.name}</h2>
              <p className="text-muted flex items-center gap-1 text-sm">
                <MapPin className="h-3.5 w-3.5" />
                {d.city ? `${d.city}, ${d.state}` : d.state} · {regionName}
              </p>
            </div>
          </div>
          {typeof d.rating === 'number' && d.rating > 0 && (
            <div className="flex items-center gap-1.5">
              <RatingStars rating={d.rating} />
              <span className="text-muted text-xs">
                {d.rating.toFixed(1)}
                {d.reviewCount ? ` (${d.reviewCount})` : ''}
              </span>
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
          </div>
          <p className="text-muted pt-1 text-xs">
            Sponsored · the exclusive partner for {regionName}
          </p>
        </div>
      </div>
    </Link>
  );
}
