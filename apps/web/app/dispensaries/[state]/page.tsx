import type { Metadata } from 'next';
import { Link } from 'next-view-transitions';
import { notFound } from 'next/navigation';
import { MapPin, Truck } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { FaqSection } from '@/components/seo/faq-section';
import { JsonLd } from '@/components/seo/json-ld';
import { displayRating, GOOGLE_RATING_COLUMNS } from '@/lib/google-rating';
import { citySlug, itemListJsonLd, pageSeo, US_STATES } from '@/lib/seo';
import { activeStateCounts } from '@/lib/locations';
import { US_STATE_NEIGHBORS } from '@/lib/state-adjacency';
import { createStaticClient } from '@/lib/supabase/static';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { RatingStars } from '@/components/rating-stars';

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

  // Top-rated shops link the state hub straight down to leaf dispensary pages
  // (not just to city hubs) — more inbound links for the pages that need them.
  // "Rated" follows the sitewide rule (displayRating): Weedtip reviews first,
  // fresh Google ratings as the fallback — first-party counts alone are near
  // zero everywhere, which used to make this whole section vanish.
  const { data: topShopsRaw } = await supabase
    .from('dispensaries')
    .select(`slug,name,city,rating_avg,rating_count,license_number,${GOOGLE_RATING_COLUMNS}`)
    .eq('status', 'active')
    .eq('state', code)
    .order('rating_count', { ascending: false })
    .order('google_rating_count', { ascending: false, nullsFirst: false })
    .limit(60);
  const topShops = (topShopsRaw ?? [])
    .map((s) => ({ ...s, shown: displayRating(s) }))
    .filter(
      (s): s is typeof s & { shown: NonNullable<ReturnType<typeof displayRating>> } =>
        s.shown !== null,
    )
    .sort((a, b) => b.shown.count - a.shown.count || b.shown.rating - a.shown.rating)
    .slice(0, 12);

  // Neighboring states that also have listings — lateral hub cross-links.
  const counts = await activeStateCounts();
  const countByCode = new Map(counts.map((c) => [c.code, c.count]));
  const neighbors = (US_STATE_NEIGHBORS[code] ?? [])
    .map((n) => ({ code: n, name: US_STATES[n], count: countByCode.get(n) ?? 0 }))
    .filter(
      (n): n is { code: string; name: string; count: number } => Boolean(n.name) && n.count > 0,
    );

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
        {cities.length > 0 && (
          <>
            {' '}
            across {cities.length} {cities.length === 1 ? 'city' : 'cities'}
          </>
        )}
        . Choose a city to see its shops.
      </p>

      {total === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted mt-6 border p-10 text-center">
          No active dispensaries are listed in {stateName} yet.
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
          {cities.map(([city, n]) => (
            <Link
              key={city}
              href={`/dispensaries/${state.toLowerCase()}/${citySlug(city)}`}
              className="rounded-card border-border bg-surface hover:border-primary/50 hover:shadow-card-hover group flex items-center justify-between gap-2 border p-4 transition-all"
            >
              <span className="flex min-w-0 items-center gap-2 font-medium">
                <MapPin className="text-muted group-hover:text-primary h-4 w-4 shrink-0" />
                <span className="truncate">{city}</span>
              </span>
              <span className="text-muted shrink-0 text-sm">
                {n} {n === 1 ? 'shop' : 'shops'}
              </span>
            </Link>
          ))}
        </div>
      )}

      {deliveryOnly > 0 && (
        <p className="text-muted mt-6 flex items-center gap-2 text-sm">
          <Truck className="h-4 w-4" />
          {deliveryOnly} delivery-only {deliveryOnly === 1 ? 'service' : 'services'} in {stateName}{' '}
          — see the{' '}
          <Link href="/deliveries" className="text-primary hover:underline">
            delivery directory
          </Link>
          .
        </p>
      )}

      {topShops.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-lg font-semibold">Top-rated dispensaries in {stateName}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topShops.map((s) => (
              <Link
                key={s.slug}
                href={`/dispensary/${s.slug}`}
                className="rounded-card border-border bg-surface hover:border-primary/50 hover:shadow-card-hover group flex items-center justify-between gap-3 border p-4 transition-all"
              >
                <span className="min-w-0">
                  <span className="group-hover:text-primary block truncate font-medium">
                    {s.name}
                  </span>
                  {s.city && <span className="text-muted block truncate text-sm">{s.city}</span>}
                </span>
                <span className="text-muted flex shrink-0 items-center gap-1 text-sm">
                  <RatingStars rating={s.shown.rating} size={13} />
                  {s.shown.rating.toFixed(1)}
                  {/* Provenance: a Google-sourced number is always named as Google's. */}
                  {s.shown.source === 'google' && <span className="text-xs">on Google</span>}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12 max-w-3xl">
        <h2 className="mb-2 text-lg font-semibold">About cannabis dispensaries in {stateName}</h2>
        <p className="text-muted text-sm leading-relaxed">
          {stateName} is home to licensed cannabis dispensaries on Weedtip. Browse menus, compare
          prices and deals, and read reviews to find the right shop near you. Always bring a valid
          21+ ID, and check your local regulations before you visit.
        </p>
      </section>

      {neighbors.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Explore nearby states</h2>
          <nav className="flex flex-wrap gap-2">
            {neighbors.map((n) => (
              <Link
                key={n.code}
                href={`/dispensaries/${n.code.toLowerCase()}`}
                className="border-border bg-surface hover:border-primary/50 text-muted hover:text-foreground rounded-full border px-3 py-1.5 text-sm transition-colors"
              >
                {n.name} <span className="text-muted/70">({n.count.toLocaleString()})</span>
              </Link>
            ))}
          </nav>
        </section>
      )}

      <FaqSection items={faqs} />
    </main>
  );
}
