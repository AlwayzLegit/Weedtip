import Link from 'next/link';

export interface CategoryPill {
  name: string;
  slug: string;
}

export function CategoryPills({ categories }: { categories: CategoryPill[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((c) => (
        <Link
          key={c.slug}
          href={`/products?category=${c.slug}`}
          className="border-border bg-surface hover:border-primary/50 hover:text-primary rounded-full border px-4 py-2 text-sm font-medium transition-colors"
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}
