import { Link } from 'next-view-transitions';
import type { StrainType } from '@weedtip/shared';
import { strainArtUrl } from '@/lib/strain-art';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { FadeImage } from './ui/fade-image';

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

// Each strain type gets a photographic colour identity (8 generated variants
// per type under public/art/strains/, picked per-slug by strainArtUrl) so a
// rail of strains reads as distinct, vivid cards instead of a wall of grey
// text. The gradient fallback paints the same hue while the photo loads.
const TYPE_FALLBACK: Record<StrainType, string> = {
  indica: 'from-violet-500/45 via-violet-500/10 to-surface',
  sativa: 'from-amber-500/45 via-amber-500/10 to-surface',
  hybrid: 'from-emerald-500/45 via-emerald-500/10 to-surface',
  cbd: 'from-sky-500/45 via-sky-500/10 to-surface',
};

export function StrainCard({ s }: { s: StrainCardData }) {
  const thc = s.thcLow != null && s.thcHigh != null ? `${s.thcLow}–${s.thcHigh}% THC` : null;
  return (
    <Link
      href={`/strain/${s.slug}`}
      className="rounded-card border-border bg-surface shadow-card hover:border-primary/50 hover:shadow-card-hover group flex h-full flex-col overflow-hidden border transition-all duration-200 hover:-translate-y-0.5"
    >
      {/* Per-strain photo header (hashed onto the type's variants) + type badge. */}
      <div
        className={cn(
          'relative h-24 overflow-hidden bg-gradient-to-br',
          TYPE_FALLBACK[s.type],
        )}
      >
        <FadeImage
          src={strainArtUrl(s.slug, s.type)}
          alt=""
          fill
          sizes="(max-width: 768px) 50vw, 300px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {/* Legibility scrim under the badges. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
        <Badge tone="primary" className="absolute left-3 top-3">
          {TYPE_LABEL[s.type]}
        </Badge>
        {thc && (
          <span className="bg-background/70 text-foreground absolute bottom-3 right-3 rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur">
            {thc}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="group-hover:text-primary truncate font-semibold transition-colors">
          {s.name}
        </h3>
        {s.effects.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.effects.slice(0, 3).map((e) => (
              <Badge key={e} tone="outline">
                {e}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
