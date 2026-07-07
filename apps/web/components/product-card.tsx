import { Link } from 'next-view-transitions';
import type { StrainType } from '@weedtip/shared';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { MediaImage } from './media-image';
import { PlacementBeacon } from './placement-beacon';
import { RatingStars } from './rating-stars';
import { Badge } from './ui/badge';

export interface ProductCardData {
  name: string;
  brand: string | null;
  priceCents: number;
  imageUrl: string | null;
  strainType: StrainType | null;
  thcPercentage: number | null;
  inStock: boolean;
  rating?: number | null;
  reviewCount?: number;
  productId?: string;
  dispensarySlug?: string;
  sponsored?: boolean;
  /** Original list price when an auto-apply sale is active (priceCents is the sale price). */
  originalPriceCents?: number | null;
  /** When set, records placement impression/click analytics for this card. */
  placementId?: string;
}

const STRAIN_LABEL: Record<StrainType, string> = {
  indica: 'Indica',
  sativa: 'Sativa',
  hybrid: 'Hybrid',
  cbd: 'CBD',
};

export function ProductCard({ p }: { p: ProductCardData }) {
  const onSale = typeof p.originalPriceCents === 'number' && p.originalPriceCents > p.priceCents;
  const body = (
    <div className="rounded-card border-border bg-surface shadow-card hover:border-primary/50 hover:shadow-card-hover h-full overflow-hidden border transition-all duration-200 hover:-translate-y-0.5">
      <MediaImage
        url={p.imageUrl}
        alt={p.name}
        artSeed={p.name}
        className="h-32"
        iconClassName="h-10 w-10"
      >
        {p.sponsored ? (
          <Badge tone="primary" className="absolute left-2 top-2">
            Sponsored
          </Badge>
        ) : onSale ? (
          <Badge tone="primary" className="absolute left-2 top-2">
            Sale
          </Badge>
        ) : (
          !p.inStock && (
            <Badge tone="muted" className="absolute left-2 top-2">
              Out of stock
            </Badge>
          )
        )}
        {p.strainType && (
          <Badge tone="primary" className="absolute right-2 top-2">
            {STRAIN_LABEL[p.strainType]}
          </Badge>
        )}
      </MediaImage>
      <div className="space-y-1 p-3">
        {p.brand && <p className="text-muted truncate text-xs">{p.brand}</p>}
        <h3 className="truncate text-sm font-semibold">{p.name}</h3>
        <div className="flex items-center justify-between pt-1">
          <span className="flex items-baseline gap-1.5">
            <span className="text-primary font-semibold">{formatPrice(p.priceCents)}</span>
            {onSale && (
              <span className="text-muted text-xs line-through">
                {formatPrice(p.originalPriceCents!)}
              </span>
            )}
          </span>
          {typeof p.thcPercentage === 'number' && (
            <span className="text-muted text-xs">{p.thcPercentage}% THC</span>
          )}
        </div>
        {typeof p.rating === 'number' && p.rating > 0 && (
          <div className="flex items-center gap-1 pt-0.5">
            <RatingStars rating={p.rating} size={12} />
            {p.reviewCount ? <span className="text-muted text-xs">({p.reviewCount})</span> : null}
          </div>
        )}
      </div>
    </div>
  );

  const href = p.productId
    ? `/product/${p.productId}`
    : p.dispensarySlug
      ? `/dispensary/${p.dispensarySlug}`
      : null;

  return href ? (
    <Link href={href} className={cn('block')}>
      {p.placementId && <PlacementBeacon placementId={p.placementId} />}
      {body}
    </Link>
  ) : (
    body
  );
}
