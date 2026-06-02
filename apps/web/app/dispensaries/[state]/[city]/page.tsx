import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { DispensaryCard } from '@/components/dispensary-card';
import { JsonLd } from '@/components/seo/json-ld';
import { citySlug, itemListJsonLd, US_STATES } from '@/lib/seo';
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
  const canonical = `/dispensaries/${state.toLowerCase()}/${city.toLowerCase()}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', title, description, url: canonical },
    twitter: { card: 'summary_large_image', title, description },
  };
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
    </main>
  );
}
