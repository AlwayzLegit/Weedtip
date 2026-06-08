import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { DispensaryCard } from '@/components/dispensary-card';
import { FaqSection } from '@/components/seo/faq-section';
import { JsonLd } from '@/components/seo/json-ld';
import { citySlug, itemListJsonLd, pageSeo, US_STATES } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

const LOCATION_SELECT =
  'id,slug,name,city,state,cover_image_url,logo_url,is_delivery,is_pickup,is_medical,is_recreational,featured,rating_avg,rating_count';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>;
}): Promise<Metadata> {
  const { state } = await params;
  const name = US_STATES[state.toUpperCase()];
  if (!name) return { title: 'Dispensaries' };
  const title = `Cannabis Dispensaries in ${name}`;
  const description = `Find licensed cannabis dispensaries in ${name}. Browse menus, deals, hours, and reviews, then order for pickup or delivery on Weedtip.`;
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

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('dispensaries')
    .select(LOCATION_SELECT)
    .eq('status', 'active')
    .eq('state', code)
    .order('city')
    .order('name');

  const shops = rows ?? [];
  const byCity = new Map<string, typeof shops>();
  for (const s of shops) {
    if (!s.city) continue; // delivery-only listings have no city to group under
    const arr = byCity.get(s.city) ?? [];
    arr.push(s);
    byCity.set(s.city, arr);
  }
  const cities = [...byCity.keys()].sort();

  const faqs = [
    {
      question: `How many cannabis dispensaries are in ${stateName}?`,
      answer: `Weedtip lists ${shops.length} licensed ${shops.length === 1 ? 'dispensary' : 'dispensaries'}${cities.length ? ` across ${cities.length} ${cities.length === 1 ? 'city' : 'cities'}` : ''} in ${stateName}, each with menus, deals, and reviews.`,
    },
    {
      question: `Can I order cannabis for pickup or delivery in ${stateName}?`,
      answer: `Many ${stateName} dispensaries on Weedtip offer in-store pickup, and some offer delivery. Each dispensary's page shows the options it supports.`,
    },
    {
      question: `Do I need to be 21 to buy cannabis in ${stateName}?`,
      answer: `You must be 21 or older (or a qualifying medical patient where permitted) and present a valid government-issued ID at pickup or delivery.`,
    },
    {
      question: `How do I find cannabis deals in ${stateName}?`,
      answer: `Check each dispensary's page for active deals, or browse the Deals page on Weedtip for current discounts near you.`,
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd data={itemListJsonLd(shops.map((s) => `/dispensary/${s.slug}`))} />
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Dispensaries', href: '/dispensaries' },
          { name: stateName, href: `/dispensaries/${state.toLowerCase()}` },
        ]}
      />
      <h1 className="text-2xl font-bold">Cannabis dispensaries in {stateName}</h1>
      <p className="text-muted mt-1 text-sm">
        {shops.length} {shops.length === 1 ? 'dispensary' : 'dispensaries'}
        {cities.length > 0 && (
          <>
            {' '}
            across {cities.length} {cities.length === 1 ? 'city' : 'cities'}
          </>
        )}
        .
      </p>

      {shops.length === 0 ? (
        <div className="rounded-card border-border bg-surface text-muted mt-6 border p-10 text-center">
          No active dispensaries are listed in {stateName} yet.
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {cities.map((city) => (
            <section key={city}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">{city}</h2>
                <Link
                  href={`/dispensaries/${state.toLowerCase()}/${citySlug(city)}`}
                  className="text-primary text-sm hover:underline"
                >
                  View all in {city}
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {byCity.get(city)!.map((s) => (
                  <DispensaryCard
                    key={s.id}
                    d={{
                      slug: s.slug,
                      name: s.name,
                      city: s.city,
                      state: s.state,
                      coverImageUrl: s.cover_image_url,
                      logoUrl: s.logo_url,
                      isDelivery: s.is_delivery,
                      isPickup: s.is_pickup,
                      isMedical: s.is_medical,
                      isRecreational: s.is_recreational,
                      featured: s.featured,
                      rating: s.rating_avg,
                      reviewCount: s.rating_count,
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <section className="mt-12 max-w-3xl">
        <h2 className="mb-2 text-lg font-semibold">
          About cannabis dispensaries in {stateName}
        </h2>
        <p className="text-muted text-sm leading-relaxed">
          {stateName} is home to licensed cannabis dispensaries on Weedtip. Browse menus, compare
          prices and deals, read reviews, and order online for pickup or delivery. Always bring a
          valid 21+ ID, and check your local regulations before ordering.
        </p>
      </section>

      <FaqSection items={faqs} />
    </main>
  );
}
