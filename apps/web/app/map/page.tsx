import type { Metadata } from 'next';
import Link from 'next/link';
import { ExploreMap, type ExplorePoint } from '@/components/explore-map';
import { pageSeo, US_STATES } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = pageSeo({
  title: 'Dispensary map',
  description:
    'Explore every licensed cannabis dispensary on an interactive map. Zoom into your state or city to find shops near you on Weedtip.',
  path: '/map',
});

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state: stateParam } = await searchParams;
  const supabase = await createClient();

  // All active listings with premise coordinates. Override the 1k default cap so
  // the whole set reaches the clustered map.
  const { data: rows } = await supabase
    .from('dispensaries')
    .select('slug,name,latitude,longitude,city,state,featured,rating_avg,rating_count')
    .eq('status', 'active')
    .not('latitude', 'is', null)
    .limit(5000);

  const all = (rows ?? []).filter(
    (r) => typeof r.latitude === 'number' && typeof r.longitude === 'number',
  );

  // State chips (code → count), most-populated first.
  const stateCounts = new Map<string, number>();
  for (const r of all) stateCounts.set(r.state, (stateCounts.get(r.state) ?? 0) + 1);
  const states = [...stateCounts.entries()].sort((a, b) => b[1] - a[1]);

  const selected = stateParam && stateCounts.has(stateParam.toUpperCase())
    ? stateParam.toUpperCase()
    : null;

  const shown = selected ? all.filter((r) => r.state === selected) : all;
  const points: ExplorePoint[] = shown.map((r) => ({
    slug: r.slug,
    name: r.name,
    lat: r.latitude as number,
    lng: r.longitude as number,
    city: r.city,
    rating: r.rating_avg,
    reviews: r.rating_count,
    featured: r.featured,
  }));

  // Center on the selected state's average position (zoom in a bit).
  let center: { lat: number; lng: number } | undefined;
  let zoom: number | undefined;
  if (selected && points.length) {
    center = {
      lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
      lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
    };
    zoom = 6;
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4">
        <p className="eyebrow mb-1">Explore</p>
        <h1 className="text-2xl font-bold sm:text-3xl">
          Dispensary map{selected ? ` · ${US_STATES[selected] ?? selected}` : ''}
        </h1>
        <p className="text-muted mt-1">
          {points.length.toLocaleString()} licensed dispensar{points.length === 1 ? 'y' : 'ies'} on
          the map. Click a cluster to zoom in, or a pin for details.
        </p>
      </div>

      {states.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/map"
            className={
              selected
                ? 'border-border text-muted hover:text-foreground rounded-full border px-3 py-1 text-sm'
                : 'border-primary bg-primary-muted text-primary rounded-full border px-3 py-1 text-sm font-medium'
            }
          >
            All ({all.length.toLocaleString()})
          </Link>
          {states.map(([code, n]) => (
            <Link
              key={code}
              href={`/map?state=${code}`}
              className={
                selected === code
                  ? 'border-primary bg-primary-muted text-primary rounded-full border px-3 py-1 text-sm font-medium'
                  : 'border-border text-muted hover:text-foreground rounded-full border px-3 py-1 text-sm'
              }
            >
              {code} ({n.toLocaleString()})
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-card border-border bg-surface-2 h-[72vh] overflow-hidden border">
        <ExploreMap points={points} center={center} zoom={zoom} />
      </div>
    </main>
  );
}
