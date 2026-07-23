import { Link } from 'next-view-transitions';
import { Star } from 'lucide-react';

/**
 * Weedmaps-style brand tile: a large square tile the logo fills (contained,
 * padded, on a dark surface so transparent logo art reads), name and supporting
 * lines underneath — a star rating when the brand has reviews (Weedmaps' tile
 * line) AND the caller's context line (products/lineup), so a tile carries both
 * trust and availability signals. An optional status chip (e.g. "Top rated")
 * sits on the tile. Brands without artwork get a bold monogram tile.
 */
export function BrandTile({
  slug,
  name,
  logoUrl,
  sub,
  rating,
  ratingCount,
  badge,
}: {
  slug: string;
  name: string;
  logoUrl: string | null;
  sub?: string | null;
  rating?: number;
  ratingCount?: number;
  /** Short data-backed status chip shown on the tile, e.g. "Top rated" / "Popular". */
  badge?: string | null;
}) {
  const hasRating = !!ratingCount && ratingCount > 0 && !!rating;
  return (
    <Link href={`/brand/${slug}`} className="group block">
      <div className="border-border bg-surface-2 group-hover:border-primary/50 relative aspect-square w-full overflow-hidden rounded-2xl border transition-colors">
        {badge && (
          <span className="bg-primary-muted text-primary ring-primary/25 absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1">
            {badge}
          </span>
        )}
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-contain p-6"
          />
        ) : (
          <span
            aria-hidden
            className="text-primary/80 absolute inset-0 flex items-center justify-center text-5xl font-bold"
          >
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <p className="group-hover:text-primary mt-2 truncate text-sm font-semibold transition-colors">
        {name}
      </p>
      {hasRating && (
        <p className="flex items-center gap-1 text-xs">
          <Star className="text-primary h-3 w-3 fill-current" />
          <span className="font-medium">{rating!.toFixed(1)}</span>
          <span className="text-muted">({ratingCount!.toLocaleString()})</span>
        </p>
      )}
      {sub && <p className="text-muted truncate text-xs">{sub}</p>}
    </Link>
  );
}
