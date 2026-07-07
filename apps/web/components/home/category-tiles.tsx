import { Link } from 'next-view-transitions';
import {
  Cookie,
  Droplet,
  Flame,
  FlaskConical,
  Hand,
  Leaf,
  Package,
  Tag,
  Wind,
  type LucideIcon,
} from 'lucide-react';

export interface CategoryTile {
  name: string;
  slug: string;
}

// Icon + accent per category slug; unknown slugs get a neutral tag tile.
const TILE_STYLE: Record<string, { icon: LucideIcon; tint: string }> = {
  flower: { icon: Leaf, tint: 'from-emerald-500/25' },
  'pre-rolls': { icon: Flame, tint: 'from-orange-500/25' },
  vapes: { icon: Wind, tint: 'from-sky-500/25' },
  edibles: { icon: Cookie, tint: 'from-amber-500/25' },
  concentrates: { icon: Droplet, tint: 'from-yellow-500/25' },
  topicals: { icon: Hand, tint: 'from-pink-500/25' },
  tinctures: { icon: FlaskConical, tint: 'from-violet-500/25' },
  accessories: { icon: Package, tint: 'from-slate-500/25' },
};

/**
 * Weedmaps-style illustrated category tiles: a bold icon tile per product
 * category linking into the catalog. Replaces the old text-pill row as the
 * homepage's primary "shop by category" module.
 */
export function CategoryTiles({ categories }: { categories: CategoryTile[] }) {
  return (
    <div className="grid grid-cols-4 gap-3 sm:gap-4 lg:grid-cols-8">
      {categories.map((c) => {
        const style = TILE_STYLE[c.slug] ?? { icon: Tag, tint: 'from-slate-500/25' };
        const Icon = style.icon;
        return (
          <Link
            key={c.slug}
            href={`/products/${c.slug}`}
            className={`rounded-card border-border bg-surface hover:border-primary/50 hover:shadow-card-hover group flex flex-col items-center gap-2 border bg-gradient-to-b ${style.tint} to-surface px-2 py-4 text-center transition-all duration-200 hover:-translate-y-0.5 sm:py-5`}
          >
            <Icon
              className="text-foreground/80 group-hover:text-primary h-7 w-7 transition-colors sm:h-8 sm:w-8"
              strokeWidth={1.75}
            />
            <span className="text-xs font-semibold sm:text-sm">{c.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
