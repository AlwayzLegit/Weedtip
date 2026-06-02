import type { Metadata } from 'next';
import Link from 'next/link';
import { pageSeo } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = pageSeo({
  title: 'Brands',
  description: 'Browse cannabis brands and find their products at dispensaries near you on Weedtip.',
  path: '/brands',
});

export default async function BrandsPage() {
  const supabase = await createClient();
  const { data: brands } = await supabase
    .from('brands')
    .select('slug,name,description')
    .order('name');

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Brands</h1>
        <p className="text-muted mt-1">Discover brands and where to find their products.</p>
      </div>

      {!brands || brands.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted border p-10 text-center">
          No brands yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((b) => (
            <Link
              key={b.slug}
              href={`/brand/${b.slug}`}
              className="rounded-card border-border bg-surface hover:border-primary/50 border p-5 transition-colors"
            >
              <h2 className="font-semibold">{b.name}</h2>
              {b.description && (
                <p className="text-muted mt-1 line-clamp-2 text-sm">{b.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
