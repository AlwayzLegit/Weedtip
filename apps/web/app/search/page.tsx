import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { Award, Leaf, Package, Search, Store } from 'lucide-react';
import { ViewTracker } from '@/components/analytics/view-tracker';
import { pageSeo } from '@/lib/seo';
import {
  SEARCH_KIND_LABEL,
  SEARCH_KIND_ORDER,
  searchResultHref,
  type SearchResult,
} from '@/lib/search';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = pageSeo({
  title: 'Search',
  description: 'Search dispensaries, products, brands, and strains on Weedtip.',
  path: '/search',
});

const KIND_ICON = { dispensary: Store, product: Package, brand: Award, strain: Leaf } as const;

/** Link to the dedicated vertical, carrying the query where that page supports it. */
function browseAllHref(kind: string, q: string): string {
  const e = encodeURIComponent(q);
  switch (kind) {
    case 'dispensary':
      return `/dispensaries?query=${e}`;
    case 'product':
      return `/products?query=${e}`;
    case 'strain':
      return `/strains?q=${e}`;
    default:
      return '/brands';
  }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();

  let results: SearchResult[] = [];
  if (query.length >= 2) {
    const supabase = await createClient();
    const { data } = await supabase.rpc('search_global', {
      search_query: query,
      per_kind_limit: 12,
    });
    results = data ?? [];
  }

  const byKind = (kind: string) => results.filter((r) => r.kind === kind);
  const hasResults = results.length > 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {query.length >= 2 && (
        <ViewTracker
          event="search_performed"
          properties={{ query, result_count: results.length, has_results: hasResults }}
        />
      )}
      <div className="mb-6">
        <p className="eyebrow mb-1">Search</p>
        <h1 className="text-2xl font-bold sm:text-3xl">
          {query ? <>Results for “{query}”</> : 'Search Weedtip'}
        </h1>
        {query && hasResults && (
          <p className="text-muted mt-1 text-sm">
            {results.length} match{results.length === 1 ? '' : 'es'} across dispensaries, products,
            brands, and strains.
          </p>
        )}
        {/* On-page query box: phones have no header search field, so without
            this, refining a search means reopening the hamburger menu. */}
        <form action="/search" className="mt-4 flex max-w-xl gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Dispensaries, products, brands, strains…"
            aria-label="Search Weedtip"
            enterKeyHint="search"
            className="border-border bg-surface focus:border-primary h-11 min-w-0 flex-1 rounded-lg border px-3.5 text-sm outline-none transition-colors"
          />
          <button
            type="submit"
            className="bg-primary bg-primary-grad text-primary-foreground inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-4 text-sm font-medium"
          >
            <Search className="h-4 w-4" /> Search
          </button>
        </form>
      </div>

      {query.length < 2 ? (
        <div className="card text-muted flex flex-col items-center gap-2 p-12 text-center">
          <Search className="h-6 w-6" />
          <p>Type at least two characters to search.</p>
        </div>
      ) : !hasResults ? (
        <div className="card text-muted p-12 text-center">
          No results for “{query}”. Try a different term.
        </div>
      ) : (
        <div className="space-y-10">
          {SEARCH_KIND_ORDER.map((kind) => {
            const items = byKind(kind);
            if (items.length === 0) return null;
            const Icon = KIND_ICON[kind];
            return (
              <section key={kind}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Icon className="text-primary h-5 w-5" />
                    {SEARCH_KIND_LABEL[kind]}
                  </h2>
                  <Link
                    href={browseAllHref(kind, query)}
                    className="text-primary text-sm hover:underline"
                  >
                    Browse all →
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((r) => (
                    <Link
                      key={`${r.kind}-${r.id}`}
                      href={searchResultHref(r)}
                      className="rounded-card border-border bg-surface shadow-card hover:border-primary/50 hover:shadow-card-hover flex items-center gap-3 border p-4 transition-all duration-200 hover:-translate-y-0.5"
                    >
                      {r.image_url ? (
                        <img
                          src={r.image_url}
                          alt=""
                          className="bg-surface-2 border-border h-12 w-12 shrink-0 rounded-xl border object-cover"
                        />
                      ) : (
                        <span className="bg-primary-muted text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                          <Icon className="h-5 w-5" />
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{r.name}</span>
                        {r.subtitle && (
                          <span className="text-muted block truncate text-sm">{r.subtitle}</span>
                        )}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
