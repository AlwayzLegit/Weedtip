'use client';

import { useEffect, useState } from 'react';
import Map, { Marker } from 'react-map-gl';
import { MapPin } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

/**
 * Small location map for the dispensary sidebar: one pin, gentle interactivity
 * (drag/zoom but no scroll hijacking). Falls back to nothing without a token —
 * the address text above it still does the job.
 */
export function MiniMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  if (!mounted) return <div className="bg-surface-2 h-44 w-full animate-pulse rounded-lg" />;

  return (
    <div className="border-border h-44 w-full overflow-hidden rounded-lg border">
      <Map
        mapboxAccessToken={token}
        initialViewState={{ latitude: lat, longitude: lng, zoom: 13.5 }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: '100%', height: '100%' }}
        scrollZoom={false}
        attributionControl={false}
      >
        <Marker latitude={lat} longitude={lng} anchor="bottom">
          <MapPin
            className="text-primary h-7 w-7 drop-shadow"
            fill="currentColor"
            strokeWidth={1}
            aria-label={`${name} location`}
          />
        </Marker>
      </Map>
    </div>
  );
}
