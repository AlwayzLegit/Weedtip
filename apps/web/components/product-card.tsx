import Link from 'next/link';
import type { StrainType } from '@weedtip/shared';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';

export interface ProductCardData {
  name: string;
  brand: string | null;
  priceCents: number;
  imageUrl: string | null;
  strainType: StrainType | null;
  thcPercentage: number | null;
  inStock: boolean;
  dispensarySlug?: string;
}

const STRAIN_LABEL: Record<StrainType, string> = {
  indica: 'Indica',
  sativa: 'Sativa',
  hybrid: 'Hybrid',
  cbd: 'CBD',
};

export function ProductCard({ p }: { p: ProductCardData }) {
  const body = (
    <div className="rounded-card border-border bg-surface hover:border-primary/50 overflow-hidden border transition-colors">
      <div
        className="from-surface-2 to-surface relative flex h-32 items-center justify-center bg-gradient-to-br"
        style={
          p.imageUrl
            ? {
                backgroundImage: `url(${p.imageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        {!p.inStock && (
          <Badge tone="muted" className="absolute left-2 top-2">
            Out of stock
          </Badge>
        )}
        {p.strainType && (
          <Badge tone="primary" className="absolute right-2 top-2">
            {STRAIN_LABEL[p.strainType]}
          </Badge>
        )}
      </div>
      <div className="space-y-1 p-3">
        {p.brand && <p className="text-muted truncate text-xs">{p.brand}</p>}
        <h3 className="truncate text-sm font-semibold">{p.name}</h3>
        <div className="flex items-center justify-between pt-1">
          <span className="text-primary font-semibold">{formatPrice(p.priceCents)}</span>
          {typeof p.thcPercentage === 'number' && (
            <span className="text-muted text-xs">{p.thcPercentage}% THC</span>
          )}
        </div>
      </div>
    </div>
  );

  return p.dispensarySlug ? (
    <Link href={`/dispensary/${p.dispensarySlug}`} className={cn('block')}>
      {body}
    </Link>
  ) : (
    body
  );
}
