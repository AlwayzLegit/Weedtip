import Link from 'next/link';
import type { StrainType } from '@weedtip/shared';
import { Badge } from './ui/badge';

export interface StrainCardData {
  slug: string;
  name: string;
  type: StrainType;
  effects: string[];
  thcLow: number | null;
  thcHigh: number | null;
}

const TYPE_LABEL: Record<StrainType, string> = {
  indica: 'Indica',
  sativa: 'Sativa',
  hybrid: 'Hybrid',
  cbd: 'CBD',
};

export function StrainCard({ s }: { s: StrainCardData }) {
  const thc = s.thcLow != null && s.thcHigh != null ? `${s.thcLow}–${s.thcHigh}% THC` : null;
  return (
    <Link
      href={`/strain/${s.slug}`}
      className="rounded-card border-border bg-surface hover:border-primary/50 block border p-4 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate font-semibold">{s.name}</h3>
        <Badge tone="primary">{TYPE_LABEL[s.type]}</Badge>
      </div>
      {thc && <p className="text-muted mt-1 text-sm">{thc}</p>}
      {s.effects.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {s.effects.slice(0, 3).map((e) => (
            <Badge key={e} tone="outline">
              {e}
            </Badge>
          ))}
        </div>
      )}
    </Link>
  );
}
