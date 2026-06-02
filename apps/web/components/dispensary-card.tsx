import Link from 'next/link';
import { MapPin, Truck, Store } from 'lucide-react';
import { formatDistance } from '@/lib/format';
import { Badge } from './ui/badge';
import { MediaImage } from './media-image';
import { RatingStars } from './rating-stars';

export interface DispensaryCardData {
  slug: string;
  name: string;
  city: string;
  state: string;
  coverImageUrl: string | null;
  isDelivery: boolean;
  isPickup: boolean;
  isMedical: boolean;
  isRecreational: boolean;
  featured?: boolean;
  sponsored?: boolean;
  distanceMeters?: number | null;
  rating?: number | null;
  reviewCount?: number;
}

export function DispensaryCard({ d }: { d: DispensaryCardData }) {
  const distance = formatDistance(d.distanceMeters ?? null);

  return (
    <Link
      href={`/dispensary/${d.slug}`}
      className="rounded-card border-border bg-surface hover:border-primary/50 group block overflow-hidden border transition-colors"
    >
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
        <h3 className="group-hover:text-primary truncate font-semibold">{d.name}</h3>
        <p className="text-muted text-sm">
          {d.city}, {d.state}
        </p>

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
          {d.isMedical && <Badge tone="outline">Medical</Badge>}
          {d.isRecreational && <Badge tone="outline">Rec</Badge>}
        </div>
      </div>
    </Link>
  );
}
