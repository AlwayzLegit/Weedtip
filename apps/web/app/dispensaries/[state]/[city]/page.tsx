import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { DispensaryCard } from '@/components/dispensary-card';
import { FaqSection } from '@/components/seo/faq-section';
import { JsonLd } from '@/components/seo/json-ld';
import { citySlug, itemListJsonLd, pageSeo, US_STATES } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

const LOCATION_SELECT =
  'id,slug,name,city,state,cover_image_url,is_delivery,is_pickup,is_medical,is_recreational,featured,rating_avg,rating_count';

async function loadCity(state: string, city: string) {
  const code = state.toUpperCase();
  const stateName = US_STATES[code];
  if (!stateName) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('dispensaries')
    .select(LOCATION_SELECT)
    .eq('status', 'active')
    .eq('state', code)
    .order('name');
  const shops = (data ?? []).filter((s) => citySlug(s.city) === city.toLowerCase());
  const first = shops[0];
  if (!first) return null;
  return { stateName, cityName: first.city, shops };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; city: string }>;
}): Promise<Metadata> {
  const { state, city } = await params;
  const found = await loadCity(state, city);
  if (!found) return { title: 'Dispensaries' };
  const title = `Dispensaries in ${found.cityName}, ${state.toUpperCase()}`;
  const description = `Find licensed cannabis dispensaries in ${found.cityName}, ${found.stateName}. Compare menus, deals, hours, and reviews, then order for pickup or delivery on Weedtip.`;
  return pageSeo({
    title,
    description,
    path: `/dispensaries/${state.toLowerCase()}/${city.toLowerCase()}`,
  });
}

export default async function CityDispensariesPage({
  params,
}: {
  params: Promise<{ state: string; city: string }>;
}) {
  const { state, city } = await params;
  const found = await loadCity(state, city);
  if (!found) notFound();
  const { stateName, cityName, shops } = found;

  const faqs = [
    {
      question: `How many cannabis dispensaries are in ${cityName}?`,
      answer: `Weedtip lists ${shops.length} licensed ${shops.length === 1 ? 'dispensary' : 'dispensaries'} in ${cityName}, ${stateName}, each with menus, deals, and reviews.`,
    },
    {
      question: `Can I order cannabis for pickup or delivery in ${cityName}?`,
      answer: `Many ${cityName} dispensaries on Weedtip offer in-store pickup, and some offer delivery. Each dispensary's page shows the options it supports.`,
    },
    {
      question: `Do I need to be 21 to buy cannabis in ${cityName}?`,
      answer: `You must be 21 or older (or a qualifying medical patient where permitted) and present a valid government-issued ID at pickup or delivery.`,
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
          { name: cityName, href: `/dispensaries/${state.toLowerCase()}/${city.toLowerCase()}` },
        ]}
      />
      <h1 className="text-2xl font-bold">
        Cannabis dispensaries in {cityName}, {state.toUpperCase()}
      </h1>
      <p className="text-muted mt-1 text-sm">
        {shops.length} {shops.length === 1 ? 'dispensary' : 'dispensaries'} in {cityName}.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shops.map((s) => (
          <DispensaryCard
            key={s.id}
            d={{
              slug: s.slug,
              name: s.name,
              city: s.city,
              state: s.state,
              coverImageUrl: s.cover_image_url,
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

      <section className="mt-12 max-w-3xl">
        <h2 className="mb-2 text-lg font-semibold">
          About cannabis dispensaries in {cityName}
        </h2>
        <p className="text-muted text-sm leading-relaxed">
          Find and compare licensed cannabis dispensaries in {cityName}, {stateName} on Weedtip.
          Browse menus, prices, and deals, read reviews, and order online for pickup or delivery.
          Bring a valid 21+ ID and check local regulations before ordering.
        </p>
      </section>

      <FaqSection items={faqs} />
    </main>
  );
}
