import { Link } from 'next-view-transitions';
import type { StrainType } from '@weedtip/shared';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DispensaryRef } from './cart/cart-provider';
import { MediaImage } from './media-image';
import { PlacementBeacon } from './placement-beacon';
import { ProductQuickAdd } from './product-quick-add';
import { RatingStars } from './rating-stars';
import { Badge } from './ui/badge';

/** Below this many units in stock we nudge shoppers with a "Low stock" flag. */
const LOW_STOCK_THRESHOLD = 5;

export interface ProductCardData {
  name: string;
  brand: string | null;
  priceCents: number;
  imageUrl: string | null;
  /**
   * Category slug (e.g. "flower", "edibles") — products without their own
   * photo fall back to the generated category art under public/art/.
   */
  categorySlug?: string | null;
  strainType: StrainType | null;
  thcPercentage: number | null;
  cbdPercentage?: number | null;
  inStock: boolean;
  /** Remaining units; drives the "Low stock" flag when known and small. */
  stockQty?: number | null;
  rating?: number | null;
  reviewCount?: number;
  productId?: string;
  dispensarySlug?: string;
  sponsored?: boolean;
  /** Original list price when an auto-apply sale is active (priceCents is the sale price). */
  originalPriceCents?: number | null;
  /** When set, records placement impression/click analytics for this card. */
  placementId?: string;
  /** When set (and in stock), renders a floating "+" quick-add to the bag. */
  quickAddDispensary?: DispensaryRef;
}

const STRAIN_LABEL: Record<StrainType, string> = {
  indica: 'Indica',
  sativa: 'Sativa',
  hybrid: 'Hybrid',
  cbd: 'CBD',
};

/** Category slugs with generated product art under public/art/category-<slug>.webp. */
const CATEGORY_ART = new Set([
  'flower',
  'pre-rolls',
  'vapes',
  'edibles',
  'concentrates',
  'topicals',
  'tinctures',
  'accessories',
]);

export function ProductCard({ p }: { p: ProductCardData }) {
  const onSale = typeof p.originalPriceCents === 'number' && p.originalPriceCents > p.priceCents;
  const discountPct = onSale
    ? Math.round(((p.originalPriceCents! - p.priceCents) / p.originalPriceCents!) * 100)
    : 0;
  const lowStock =
    p.inStock && typeof p.stockQty === 'number' && p.stockQty > 0 && p.stockQty <= LOW_STOCK_THRESHOLD;
  const imageUrl =
    p.imageUrl ??
    (p.categorySlug && CATEGORY_ART.has(p.categorySlug)
      ? `/art/category-${p.categorySlug}.webp`
      : null);
  const body = (
    <div className="rounded-card border-border bg-surface shadow-card hover:border-primary/50 hover:shadow-card-hover h-full overflow-hidden border transition-all duration-200 hover:-translate-y-0.5">
      <MediaImage
        url={imageUrl}
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
            {discountPct > 0 ? `−${discountPct}%` : 'Sale'}
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
          {(typeof p.thcPercentage === 'number' || typeof p.cbdPercentage === 'number') && (
            <span className="text-muted text-xs">
              {typeof p.thcPercentage === 'number' && `${p.thcPercentage}% THC`}
              {typeof p.thcPercentage === 'number' &&
                typeof p.cbdPercentage === 'number' &&
                ' · '}
              {typeof p.cbdPercentage === 'number' && `${p.cbdPercentage}% CBD`}
            </span>
          )}
        </div>
        {typeof p.rating === 'number' && p.rating > 0 && (
          <div className="flex items-center gap-1 pt-0.5">
            <RatingStars rating={p.rating} size={12} />
            {p.reviewCount ? <span className="text-muted text-xs">({p.reviewCount})</span> : null}
          </div>
        )}
        {lowStock && (
          <p className="text-warning pt-0.5 text-xs font-medium">Low stock — order soon</p>
        )}
      </div>
    </div>
  );

  const href = p.productId
    ? `/product/${p.productId}`
    : p.dispensarySlug
      ? `/dispensary/${p.dispensarySlug}`
      : null;

  // A floating quick-add sits OUTSIDE the Link so tapping it adds to the bag
  // instead of navigating; only meaningful when we know the shop + it's stocked.
  const quickAdd =
    p.quickAddDispensary && p.inStock && p.productId ? (
      <ProductQuickAdd
        dispensary={p.quickAddDispensary}
        product={{ productId: p.productId, name: p.name, priceCents: p.priceCents }}
      />
    ) : null;

  if (!href) return body;

  return (
    <div className="relative h-full">
      <Link href={href} className={cn('block h-full')}>
        {p.placementId && <PlacementBeacon placementId={p.placementId} />}
        {body}
      </Link>
      {quickAdd}
    </div>
  );
}
