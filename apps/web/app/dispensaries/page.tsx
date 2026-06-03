import type { Metadata } from 'next';
import Link from 'next/link';
import { dispensarySearchSchema } from '@weedtip/shared';
import { searchDispensaries } from '@weedtip/supabase/queries';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { DispensaryCard } from '@/components/dispensary-card';
import { DispensaryFilters } from '@/components/dispensary-filters';
import { DispensaryMap, type MapPoint } from '@/components/dispensary-map';
import { SearchBar } from '@/components/search-bar';
import { JsonLd } from '@/components/seo/json-ld';
import { Button } from '@/components/ui/button';
import { itemListJsonLd, pageSeo } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = pageSeo({
  title: 'Dispensaries',
  description:
    'Browse licensed cannabis dispensaries near you. Filter by pickup, delivery, open now, and category, then view menus, deals, and reviews on Weedtip.',
  path: '/dispensaries',
});

type SearchParams = Record<string, string | string[] | undefined>;

function num(v: string | string[] | undefined): number | undefined {
  if (typeof v !== 'string' || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
const truthy = (v: string | string[] | undefined) => (v === 'true' ? true : undefined);

export default async function DispensariesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const params = dispensarySearchSchema.parse({
    query: typeof sp.query === 'string' ? sp.query : undefined,
    lat: num(sp.lat),
    lng: num(sp.lng),
    radius_meters: num(sp.radius_meters),
    is_delivery: truthy(sp.is_delivery),
    is_pickup: truthy(sp.is_pickup),
    is_medical: truthy(sp.is_medical),
    is_recreational: truthy(sp.is_recreational),
    open_now: truthy(sp.open_now),
    category_slug: typeof sp.category === 'string' ? sp.category : undefined,
    page: num(sp.page),
  });

  const supabase = await createClient();
  const { data, error } = await searchDispensaries(supabase, params);
  const rows = [...(data ?? [])];
  const total = rows[0]?.total_count ?? 0;

  // Client-side sort over the page of results.
  const sort = typeof sp.sort === 'string' ? sp.sort : '';
  if (sort === 'rating')
    rows.sort((a, b) => b.rating_avg - a.rating_avg || b.rating_count - a.rating_count);
  else if (sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'distance')
    rows.sort((a, b) => (a.distance_meters ?? Infinity) - (b.distance_meters ?? Infinity));
  const hasMore = (params.page + 1) * params.page_size < total;

  const points: MapPoint[] = rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    lat: r.latitude,
    lng: r.longitude,
    featured: r.featured,
  }));

  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    Object.entries(sp).forEach(([k, v]) => {
      if (typeof v === 'string') next.set(k, v);
    });
    next.set('page', String(page));
    return `/dispensaries?${next.toString()}`;
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd data={itemListJsonLd(rows.map((r) => `/dispensary/${r.slug}`))} />
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Dispensaries', href: '/dispensaries' },
        ]}
      />
      <div className="mb-6 space-y-4">
        <h1 className="text-2xl font-bold">Dispensaries</h1>
        <SearchBar />
        <DispensaryFilters />
      </div>

      {error ? (
        <p className="text-danger">Couldn&apos;t load dispensaries. Please try again.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Results */}
          <div className="lg:col-span-2">
            <p className="text-muted mb-4 text-sm">
              {total} {total === 1 ? 'result' : 'results'}
              {params.query ? ` for “${params.query}”` : ''}
            </p>

            {rows.length === 0 ? (
              <div className="rounded-card border-border bg-surface border p-10 text-center">
                <p className="font-medium">No dispensaries found</p>
                <p className="text-muted mt-1 text-sm">
                  Try widening your search or clearing filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {rows.map((r) => (
                  <DispensaryCard
                    key={r.id}
                    d={{
                      slug: r.slug,
                      name: r.name,
                      city: r.city,
                      state: r.state,
                      coverImageUrl: r.cover_image_url,
                      isDelivery: r.is_delivery,
                      isPickup: r.is_pickup,
                      isMedical: r.is_medical,
                      isRecreational: r.is_recreational,
                      featured: r.featured,
                      distanceMeters: r.distance_meters,
                      rating: r.rating_avg,
                      reviewCount: r.rating_count,
                    }}
                  />
                ))}
              </div>
            )}

            {(params.page > 0 || hasMore) && (
              <div className="mt-8 flex items-center justify-between">
                {params.page > 0 ? (
                  <Link href={pageHref(params.page - 1)}>
                    <Button variant="outline" size="sm">
                      Previous
                    </Button>
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-muted text-sm">Page {params.page + 1}</span>
                {hasMore ? (
                  <Link href={pageHref(params.page + 1)}>
                    <Button variant="outline" size="sm">
                      Next
                    </Button>
                  </Link>
                ) : (
                  <span />
                )}
              </div>
            )}
          </div>

          {/* Map */}
          <div className="hidden lg:block">
            <div className="rounded-card border-border sticky top-20 h-[70vh] overflow-hidden border">
              <DispensaryMap
                points={points}
                center={params.lat && params.lng ? { lat: params.lat, lng: params.lng } : undefined}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
