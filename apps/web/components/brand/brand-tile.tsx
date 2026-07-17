import { Link } from 'next-view-transitions';

/**
 * Weedmaps-style brand tile: a large square tile the logo fills (contained,
 * padded, on a dark surface so transparent logo art reads), name and a
 * supporting line underneath. Brands without artwork get a bold monogram tile
 * instead of a tiny letter chip.
 */
export function BrandTile({
  slug,
  name,
  logoUrl,
  sub,
}: {
  slug: string;
  name: string;
  logoUrl: string | null;
  sub?: string | null;
}) {
  return (
    <Link href={`/brand/${slug}`} className="group block">
      <div className="border-border bg-surface-2 group-hover:border-primary/50 relative aspect-square w-full overflow-hidden rounded-2xl border transition-colors">
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
      {sub && <p className="text-muted truncate text-xs">{sub}</p>}
    </Link>
  );
}
