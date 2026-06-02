import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { DispensaryCard } from '@/components/dispensary-card';
import { JsonLd } from '@/components/seo/json-ld';
import { citySlug, itemListJsonLd, US_STATES } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

const LOCATION_SELECT =
  'id,slug,name,city,state,cover_image_url,is_delivery,is_pickup,is_medical,is_recreational,featured,rating_avg,rating_count';

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
  const canonical = `/dispensaries/${state.toLowerCase()}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', title, description, url: canonical },
    twitter: { card: 'summary_large_image', title, description },
  };
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
    const arr = byCity.get(s.city) ?? [];
    arr.push(s);
    byCity.set(s.city, arr);
  }
  const cities = [...byCity.keys()].sort();

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
    </main>
  );
}
