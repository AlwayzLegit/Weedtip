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

export interface CategoryPill {
  name: string;
  slug: string;
}

// Map category slugs to icons. Falls back to a generic tag for unknown slugs.
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  flower: Leaf,
  'pre-rolls': Flame,
  vapes: Wind,
  edibles: Cookie,
  concentrates: Droplet,
  topicals: Hand,
  tinctures: FlaskConical,
  accessories: Package,
};

export function CategoryPills({ categories }: { categories: CategoryPill[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((c) => {
        const Icon = CATEGORY_ICONS[c.slug] ?? Tag;
        return (
          <Link
            key={c.slug}
            href={`/products/${c.slug}`}
            className="border-border bg-surface hover:border-primary/50 hover:text-primary group flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
          >
            <Icon className="text-muted group-hover:text-primary h-4 w-4 transition-colors" />
            {c.name}
          </Link>
        );
      })}
    </div>
  );
}
