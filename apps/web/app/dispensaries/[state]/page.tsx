import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { notFound } from 'next/navigation';
import { MapPin, Truck } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { FaqSection } from '@/components/seo/faq-section';
import { JsonLd } from '@/components/seo/json-ld';
import { citySlug, itemListJsonLd, pageSeo, US_STATES } from '@/lib/seo';
import { createStaticClient } from '@/lib/supabase/static';
import { fetchAll } from '@/lib/supabase/fetch-all';

// Public, anon-only page — serve cached HTML and refresh every 60 min (ISR).
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>;
}): Promise<Metadata> {
  const { state } = await params;
  const name = US_STATES[state.toUpperCase()];
  if (!name) return { title: 'Dispensaries' };
  const title = `Cannabis Dispensaries in ${name}`;
  const description = `Find licensed cannabis dispensaries across ${name} by city. Browse menus, deals, hours, and reviews on Weedtip.`;
  return pageSeo({ title, description, path: `/dispensaries/${state.toLowerCase()}` });
}

export default async function StateDispensariesPage({
  params,
}: {
  params: Promise<{ state: string }>;
}) {
  const { state } = await params;
  const code = state.toUpperCase();
  const stateName = US_STATES[code];
  if (!stateName) notFound();

  const supabase = createStaticClient();
  // A single state can exceed PostgREST's 1k cap, so page the full set. We only
  // read the columns needed to build the city directory (not full shop rows),
  // so even the largest states stay cheap.
  const rows = await fetchAll<{ city: string | null; is_delivery: boolean }>((from, to) =>
    supabase
      .from('dispensaries')
      .select('city,is_delivery')
      .eq('status', 'active')
      .eq('state', code)
      .range(from, to),
  );

  const total = rows.length;
  const byCity = new Map<string, number>();
  let deliveryOnly = 0;
  for (const r of rows) {
    if (!r.city) {
      deliveryOnly += 1; // delivery-only listings have no city to group under
      continue;
    }
    byCity.set(r.city, (byCity.get(r.city) ?? 0) + 1);
  }
  // Biggest markets first, then alphabetical.
  const cities = [...byCity.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const faqs = [
    {
      question: `How many cannabis dispensaries are in ${stateName}?`,
      answer: `Weedtip lists ${total} licensed ${total === 1 ? 'dispensary' : 'dispensaries'}${cities.length ? ` across ${cities.length} ${cities.length === 1 ? 'city' : 'cities'}` : ''} in ${stateName}, each with menus, deals, and reviews.`,
    },
    {
      question: `How do I find a cannabis dispensary in ${stateName}?`,
      answer: `Browse ${stateName} by city on Weedtip to see licensed dispensaries near you, each with its menu, deals, hours, and reviews. Open any dispensary's page for its address, phone, and directions.`,
    },
    {
      question: `Do I need to be 21 to buy cannabis in ${stateName}?`,
      answer: `You must be 21 or older (or a qualifying medical patient where permitted) and present a valid government-issued ID at the dispensary.`,
    },
    {
      question: `How do I find cannabis deals in ${stateName}?`,
      answer: `Open your city below, then check each dispensary's page for active deals, or browse the Deals page for current discounts.`,
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd
        data={itemListJsonLd(
          cities.map(([city]) => `/dispensaries/${state.toLowerCase()}/${citySlug(city)}`),
        )}
      />
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Dispensaries', href: '/dispensaries' },
          { name: stateName, href: `/dispensaries/${state.toLowerCase()}` },
        ]}
      />
      <h1 className="text-2xl font-bold">Cannabis dispensaries in {stateName}</h1>
      <p className="text-muted mt-1 text-sm">
        {total.toLocaleString()} {total === 1 ? 'dispensary' : 'dispensaries'}
        {cities.length > 0 && <> across {cities.length} {cities.length === 1 ? 'city' : 'cities'}</>}.
        Choose a city to see its shops.
      </p>

      {total === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted mt-6 border p-10 text-center">
          No active dispensaries are listed in {stateName} yet.
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map(([city, n]) => (
            <Link
              key={city}
              href={`/dispensaries/${state.toLowerCase()}/${citySlug(city)}`}
              className="rounded-card border-border bg-surface hover:border-primary/50 hover:shadow-card-hover group flex items-center justify-between border p-4 transition-all"
            >
              <span className="flex items-center gap-2 font-medium">
                <MapPin className="text-muted group-hover:text-primary h-4 w-4" />
                {city}
              </span>
              <span className="text-muted text-sm">
                {n} {n === 1 ? 'shop' : 'shops'}
              </span>
            </Link>
          ))}
        </div>
      )}

      {deliveryOnly > 0 && (
        <p className="text-muted mt-6 flex items-center gap-2 text-sm">
          <Truck className="h-4 w-4" />
          {deliveryOnly} delivery-only {deliveryOnly === 1 ? 'service' : 'services'} in {stateName} —
          see the{' '}
          <Link href="/deliveries" className="text-primary hover:underline">
            delivery directory
          </Link>
          .
        </p>
      )}

      <section className="mt-12 max-w-3xl">
        <h2 className="mb-2 text-lg font-semibold">About cannabis dispensaries in {stateName}</h2>
        <p className="text-muted text-sm leading-relaxed">
          {stateName} is home to licensed cannabis dispensaries on Weedtip. Browse menus, compare
          prices and deals, and read reviews to find the right shop near you. Always bring a
          valid 21+ ID, and check your local regulations before you visit.
        </p>
      </section>

      <FaqSection items={faqs} />
    </main>
  );
}
