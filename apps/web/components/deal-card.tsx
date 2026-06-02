import Link from 'next/link';
import { Badge } from './ui/badge';

export interface DealCardData {
  title: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  dispensarySlug: string;
  dispensaryName: string;
  city: string;
  state: string;
}

function discountLabel(type: string, value: number): string {
  if (type === 'percentage') return `${value}% off`;
  if (type === 'fixed') return `$${value} off`;
  return 'BOGO';
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
        <p className="text-muted mt-2 text-xs">
          {deal.dispensaryName} · {deal.city}, {deal.state}
        </p>
      </div>
      <Badge tone="primary" className="shrink-0">
        {discountLabel(deal.discountType, deal.discountValue)}
      </Badge>
    </Link>
  );
}
