import { Link } from 'next-view-transitions';
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
}

export function DealCard({ deal }: { deal: DealCardData }) {
  return (
    <Link
      href={`/dispensary/${deal.dispensarySlug}`}
      className="rounded-card border-primary/30 bg-primary-muted hover:border-primary flex items-start justify-between gap-3 border p-5 transition-colors"
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
        <p className="text-muted mt-2 text-xs">
          {deal.dispensaryName} · {deal.city}, {deal.state}
        </p>
      </div>
      <Badge tone="primary" className="shrink-0">
        {dealBadge(deal.discountType, deal.discountValue)}
      </Badge>
    </Link>
  );
}
