import Image from 'next/image';
import { Link } from 'next-view-transitions';

export interface CategoryTile {
  name: string;
  slug: string;
}

/** Categories with generated photo tiles under public/art/category-<slug>.webp. */
const PHOTO_SLUGS = new Set([
  'flower',
  'pre-rolls',
  'vapes',
  'edibles',
  'concentrates',
  'topicals',
  'tinctures',
  'accessories',
]);

/**
 * Weedmaps-style illustrated category tiles: a photographic tile per product
 * category linking into the catalog. Slugs without generated art fall back to
 * a plain tinted tile.
 */
export function CategoryTiles({ categories }: { categories: CategoryTile[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-8">
      {categories.map((c) => (
        <Link
          key={c.slug}
          href={`/products/${c.slug}`}
          className="rounded-card border-border bg-surface hover:border-primary/50 hover:shadow-card-hover group relative flex aspect-square flex-col justify-end overflow-hidden border transition-all duration-200 hover:-translate-y-0.5"
        >
          {PHOTO_SLUGS.has(c.slug) && (
            <Image
              src={`/art/category-${c.slug}.webp`}
              alt=""
              fill
              sizes="(max-width: 640px) 33vw, 160px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
          {/* Legibility scrim over the photo. */}
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent"
          />
          <span className="relative px-2 pb-2.5 text-center text-xs font-semibold text-white sm:text-sm">
            {c.name}
          </span>
        </Link>
      ))}
    </div>
  );
}
