import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { MapPin } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { activeStateCounts } from '@/lib/locations';
import { itemListJsonLd, pageSeo } from '@/lib/seo';

// Public, anon-only index — cached HTML refreshed hourly (ISR).
export const revalidate = 3600;

export const metadata: Metadata = pageSeo({
  title: 'Cannabis Dispensaries by State',
  description:
    'Browse licensed cannabis dispensaries by state on Weedtip. Pick your state to find shops by city, with menus, deals, hours, and reviews.',
  path: '/dispensaries/locations',
});

/**
 * The crawlable root of the location tree: every state with active listings,
 * linked from here and from the sitewide footer. It puts each state directory
 * hub ≤1 click from any page, so the state → city → shop pages stop being
 * reachable only via the sitemap (SEO cause C — internal linking).
 */
export default async function LocationsIndexPage() {
  const states = await activeStateCounts();
  const totalShops = states.reduce((sum, s) => sum + s.count, 0);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd data={itemListJsonLd(states.map((s) => `/dispensaries/${s.code.toLowerCase()}`))} />
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Dispensaries', href: '/dispensaries' },
          { name: 'By state', href: '/dispensaries/locations' },
        ]}
      />
      <h1 className="text-2xl font-bold">Cannabis dispensaries by state</h1>
      <p className="text-muted mt-1 text-sm">
        {totalShops.toLocaleString()} licensed dispensaries across {states.length}{' '}
        {states.length === 1 ? 'state' : 'states'} on Weedtip. Choose a state to browse shops by
        city.
      </p>

      {states.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted mt-6 border p-10 text-center">
          No active dispensaries are listed yet.
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {states.map((s) => (
            <Link
              key={s.code}
              href={`/dispensaries/${s.code.toLowerCase()}`}
              className="rounded-card border-border bg-surface hover:border-primary/50 hover:shadow-card-hover group flex items-center justify-between border p-4 transition-all"
            >
              <span className="flex items-center gap-2 font-medium">
                <MapPin className="text-muted group-hover:text-primary h-4 w-4" />
                {s.name}
              </span>
              <span className="text-muted text-sm">
                {s.count.toLocaleString()} {s.count === 1 ? 'shop' : 'shops'}
              </span>
            </Link>
          ))}
        </div>
      )}

      <section className="mt-12 max-w-3xl">
        <h2 className="mb-2 text-lg font-semibold">Find a dispensary near you</h2>
        <p className="text-muted text-sm leading-relaxed">
          Weedtip lists licensed cannabis dispensaries and delivery services across the United
          States. Pick your state to see shops by city, or open the{' '}
          <Link href="/dispensaries" className="text-primary hover:underline">
            live map
          </Link>{' '}
          to search near your location. Compare menus, prices, and deals, read reviews, and always
          bring a valid 21+ ID when you visit.
        </p>
      </section>
    </main>
  );
}
