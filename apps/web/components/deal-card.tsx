import { Link } from 'next-view-transitions';
import { Star } from 'lucide-react';
import { dealBadge } from '@/lib/format';
import { Badge } from './ui/badge';

export interface DealCardData {
  title: string;
  description: string | null;
  code: string | null;
  discountType: string;
  discountValue: number;
  dispensarySlug: string;
  dispensaryName: string;
  city: string;
  state: string;
  ratingAvg?: number | null;
  ratingCount?: number | null;
}

export function DealCard({ deal }: { deal: DealCardData }) {
  return (
    <Link
      href={`/dispensary/${deal.dispensarySlug}`}
      className="rounded-card border-primary/30 bg-primary-muted hover:border-primary focus-visible:ring-primary flex h-full items-start justify-between gap-3 border p-5 transition-colors focus-visible:outline-none focus-visible:ring-2"
    >
      <div className="min-w-0">
        <p className="text-primary font-semibold">{deal.title}</p>
        {deal.description && (
          <p className="text-muted mt-1 line-clamp-2 text-sm">{deal.description}</p>
        )}
        {deal.code && (
          <p className="mt-2 text-xs">
            <span className="border-primary/40 text-primary rounded border border-dashed px-1.5 py-0.5 font-mono font-medium">
              {deal.code}
            </span>
          </p>
        )}
        <p className="text-muted mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span>
            {deal.dispensaryName} · {deal.city}, {deal.state}
          </span>
          {deal.ratingAvg != null && deal.ratingAvg > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <Star className="text-primary h-3 w-3 fill-current" />
              {deal.ratingAvg.toFixed(1)}
              {deal.ratingCount ? ` (${deal.ratingCount})` : ''}
            </span>
          )}
        </p>
      </div>
      <Badge tone="primary" className="shrink-0">
        {dealBadge(deal.discountType, deal.discountValue)}
      </Badge>
    </Link>
  );
}
