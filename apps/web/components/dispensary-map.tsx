'use client';

import { useEffect, useState } from 'react';
import Map, { Marker } from 'react-map-gl';
import { MapPin } from 'lucide-react';
import Link from 'next/link';
import 'mapbox-gl/dist/mapbox-gl.css';

export interface MapPoint {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  /** Featured/paid listings get a distinct gold pin (Weedmaps-style tiering). */
  featured?: boolean;
}

/**
 * Mapbox map of dispensary results. Renders client-side only (guards SSR). When
 * NEXT_PUBLIC_MAPBOX_TOKEN is absent, shows a graceful fallback so the page works
 * without a token — add the token to enable the interactive map.
 */
export function DispensaryMap({
  points,
  center,
}: {
  points: MapPoint[];
  center?: { lat: number; lng: number };
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const first = center ?? points[0];

  if (!mounted) {
    return <div className="bg-surface-2 h-full w-full animate-pulse" />;
  }

  if (!token) {
    return (
      <div className="bg-surface-2 flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
        <MapPin className="text-muted h-8 w-8" />
        <p className="text-sm font-medium">Map preview</p>
        <p className="text-muted max-w-xs text-xs">
          Set <code className="text-primary">NEXT_PUBLIC_MAPBOX_TOKEN</code> to enable the
          interactive map. {points.length} location{points.length === 1 ? '' : 's'} in view.
        </p>
      </div>
    );
  }

  return (
    <Map
      mapboxAccessToken={token}
      initialViewState={{
        latitude: first?.lat ?? 39.5,
        longitude: first?.lng ?? -98.35,
        zoom: first ? 10 : 3.5,
      }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      style={{ width: '100%', height: '100%' }}
    >
      {/* Render featured pins last so their gold markers sit on top. */}
      {[...points]
        .sort((a, b) => Number(!!a.featured) - Number(!!b.featured))
        .map((p) => (
          <Marker key={p.slug} latitude={p.lat} longitude={p.lng} anchor="bottom">
            <Link href={`/dispensary/${p.slug}`} title={p.featured ? `${p.name} (Featured)` : p.name}>
              <MapPin
                className={
                  p.featured
                    ? 'h-8 w-8 fill-amber-400/40 text-amber-400 drop-shadow'
                    : 'fill-primary/30 text-primary h-7 w-7'
                }
              />
            </Link>
          </Marker>
        ))}
    </Map>
  );
}
