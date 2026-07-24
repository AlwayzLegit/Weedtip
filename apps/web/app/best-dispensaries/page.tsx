import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { Award, Truck } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { EmptyState } from '@/components/ui/empty-state';
import { loadBestOfMarkets, type BestOfMarket } from '@/lib/best-of';
import { pageSeo } from '@/lib/seo';

// Public, anon-only hub — cached HTML, refreshed hourly (ISR).
export const revalidate = 3600;

export const metadata: Metadata = pageSeo({
  title: 'Best dispensaries by city',
  description:
    'Weedtip rankings of the best cannabis dispensaries and delivery services, city by city — each ranked by customer ratings. Find the top-rated shops near you.',
  path: '/best-dispensaries',
});

export default async function BestOfHubPage() {
  const markets = await loadBestOfMarkets();

  // Group qualifying cities by state for a scannable, crawlable index.
  const byState = new Map<string, BestOfMarket[]>();
  for (const m of markets) {
    byState.set(m.stateName, [...(byState.get(m.stateName) ?? []), m]);
  }
  const states = [...byState.entries()];
  const deliveryMarkets = markets.filter((m) => m.hasDelivery).length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Dispensaries', href: '/dispensaries' },
          { name: 'Best of', href: '/best-dispensaries' },
        ]}
      />

      <div className="border-primary/25 bg-primary-subtle text-primary mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold">
        <Award className="h-3.5 w-3.5" /> Weedtip rankings
      </div>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Best dispensaries, city by city</h1>
      <p className="text-muted mt-2 max-w-2xl leading-relaxed">
        The top-rated cannabis dispensaries in every market with enough rated shops to rank, scored
        by a confidence-weighted average of their customer ratings — so consistency, not a lone
        five-star, decides the order. Where a shop has been reviewed on Weedtip we rank on those
        reviews; otherwise we use its Google rating, shown and linked as Google&apos;s. Rankings
        update as new ratings come in, and positions are never sold.
      </p>

      {markets.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={Award}
            title="Rankings are on the way"
            description="Markets appear here once they have enough rated dispensaries to rank credibly. Browse the full directory in the meantime."
            action={{ label: 'Browse dispensaries', href: '/dispensaries' }}
          />
        </div>
      ) : (
        <>
          <p className="text-muted mt-4 text-sm">
            {markets.length} ranked {markets.length === 1 ? 'market' : 'markets'} across{' '}
            {states.length} {states.length === 1 ? 'state' : 'states'}
            {deliveryMarkets > 0 && <> · {deliveryMarkets} with a delivery ranking</>}.
          </p>

          <div className="mt-8 space-y-8">
            {states.map(([stateName, cities]) => (
              <section key={stateName}>
                <h2 className="border-border mb-3 border-b pb-2 text-lg font-semibold">
                  {stateName}{' '}
                  <span className="text-muted text-sm font-normal">
                    ({cities.length} {cities.length === 1 ? 'city' : 'cities'})
                  </span>
                </h2>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {cities.map((m) => (
                    <li key={m.citySlug} className="flex items-stretch gap-2">
                      <Link
                        href={`/best-dispensaries/${m.state.toLowerCase()}/${m.citySlug}`}
                        className="rounded-card border-border bg-surface hover:border-primary/50 focus-visible:ring-primary group min-w-0 flex-1 border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2"
                      >
                        <span className="group-hover:text-primary block truncate font-medium transition-colors">
                          Best in {m.city}
                        </span>
                        <span className="text-muted text-xs">
                          {m.ratedCount} rated {m.ratedCount === 1 ? 'shop' : 'shops'}
                        </span>
                      </Link>
                      {m.hasDelivery && (
                        <Link
                          href={`/best-delivery/${m.state.toLowerCase()}/${m.citySlug}`}
                          className="rounded-card border-border bg-surface text-muted hover:border-primary/50 hover:text-primary focus-visible:ring-primary flex shrink-0 items-center border px-3 transition-colors focus-visible:outline-none focus-visible:ring-2"
                          aria-label={`Best delivery in ${m.city}`}
                          title={`Best delivery in ${m.city}`}
                        >
                          <Truck className="h-4 w-4" />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
