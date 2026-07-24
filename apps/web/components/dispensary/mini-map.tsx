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
  if (!mounted) return <div className="bg-surface-2 h-52 w-full animate-pulse rounded-lg" />;

  return (
    <div className="border-border h-52 w-full overflow-hidden rounded-lg border">
      <Map
        mapboxAccessToken={token}
        initialViewState={{ latitude: lat, longitude: lng, zoom: 14 }}
        // Daylight navigation tiles — on-theme for the light pastel UI.
        mapStyle="mapbox://styles/mapbox/navigation-day-v1"
        style={{ width: '100%', height: '100%' }}
        scrollZoom={false}
        attributionControl={false}
      >
        <Marker latitude={lat} longitude={lng} anchor="bottom">
          <span className="relative flex flex-col items-center" aria-label={`${name} location`}>
            <MapPin
              className="text-primary h-8 w-8 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
              fill="currentColor"
              strokeWidth={1.5}
            />
            {/* Soft ground glow so the pin reads against busy map tiles. */}
            <span className="bg-primary/30 -mt-1 h-1.5 w-3 rounded-full blur-[2px]" aria-hidden />
          </span>
        </Marker>
      </Map>
    </div>
  );
}
