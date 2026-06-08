'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Map, { Layer, Popup, Source, type LayerProps, type MapRef } from 'react-map-gl';
import type { GeoJSONSource, MapLayerMouseEvent } from 'mapbox-gl';
import { MapPin } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

export interface ExplorePoint {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  city: string | null;
  rating: number;
  reviews: number;
  featured: boolean;
}

const clusterLayer: LayerProps = {
  id: 'clusters',
  type: 'circle',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': ['step', ['get', 'point_count'], '#34d399', 25, '#10b981', 100, '#059669'],
    'circle-radius': ['step', ['get', 'point_count'], 16, 25, 22, 100, 30],
    'circle-opacity': 0.85,
    'circle-stroke-width': 1,
    'circle-stroke-color': '#0b0b0b',
  },
};

const clusterCountLayer: LayerProps = {
  id: 'cluster-count',
  type: 'symbol',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': ['get', 'point_count_abbreviated'],
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': 12,
  },
  paint: { 'text-color': '#04231a' },
};

const unclusteredLayer: LayerProps = {
  id: 'unclustered-point',
  type: 'circle',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-color': ['case', ['get', 'featured'], '#fbbf24', '#34d399'],
    'circle-radius': ['case', ['get', 'featured'], 7, 5],
    'circle-stroke-width': 1.5,
    'circle-stroke-color': '#0b0b0b',
  },
};

/**
 * Full clustered map of every dispensary in view. Unlike the per-result-page map
 * on /dispensaries, this plots the whole set at once via Mapbox clustering, so
 * thousands of points stay performant. Falls back gracefully without a token.
 */
export function ExploreMap({
  points,
  center,
  zoom,
}: {
  points: ExplorePoint[];
  center?: { lat: number; lng: number };
  zoom?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [popup, setPopup] = useState<ExplorePoint | null>(null);
  const mapRef = useRef<MapRef>(null);
  useEffect(() => setMounted(true), []);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: points.map((p) => ({
        type: 'Feature' as const,
        properties: {
          slug: p.slug,
          name: p.name,
          city: p.city,
          rating: p.rating,
          reviews: p.reviews,
          featured: p.featured,
        },
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      })),
    }),
    [points],
  );

  if (!mounted) return <div className="bg-surface-2 h-full w-full animate-pulse" />;

  if (!token) {
    return (
      <div className="bg-surface-2 flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
        <MapPin className="text-muted h-8 w-8" />
        <p className="text-sm font-medium">Map preview</p>
        <p className="text-muted max-w-xs text-xs">
          Set <code className="text-primary">NEXT_PUBLIC_MAPBOX_TOKEN</code> to enable the
          interactive map. {points.length.toLocaleString()} location
          {points.length === 1 ? '' : 's'} in view.
        </p>
      </div>
    );
  }

  const onClick = (e: MapLayerMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature) {
      setPopup(null);
      return;
    }
    const geom = feature.geometry;
    const coords = geom.type === 'Point' ? (geom.coordinates as [number, number]) : null;
    if (feature.layer?.id === 'clusters' && coords) {
      const clusterId = feature.properties?.cluster_id as number;
      const src = mapRef.current?.getSource('dispensaries') as GeoJSONSource | undefined;
      src?.getClusterExpansionZoom(clusterId, (err, expZoom) => {
        if (err || expZoom == null) return;
        mapRef.current?.easeTo({ center: coords, zoom: expZoom, duration: 500 });
      });
    } else if (coords) {
      const p = feature.properties ?? {};
      setPopup({
        slug: p.slug,
        name: p.name,
        city: p.city ?? null,
        rating: Number(p.rating ?? 0),
        reviews: Number(p.reviews ?? 0),
        featured: p.featured === true || p.featured === 'true',
        lng: coords[0],
        lat: coords[1],
      });
    }
  };

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={token}
      initialViewState={{
        latitude: center?.lat ?? 37.3,
        longitude: center?.lng ?? -119.4,
        zoom: zoom ?? 5,
      }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      style={{ width: '100%', height: '100%' }}
      interactiveLayerIds={['clusters', 'unclustered-point']}
      onClick={onClick}
      cursor="pointer"
    >
      <Source
        id="dispensaries"
        type="geojson"
        data={geojson}
        cluster
        clusterMaxZoom={13}
        clusterRadius={50}
      >
        <Layer {...clusterLayer} />
        <Layer {...clusterCountLayer} />
        <Layer {...unclusteredLayer} />
      </Source>

      {popup && (
        <Popup
          latitude={popup.lat}
          longitude={popup.lng}
          anchor="bottom"
          offset={12}
          closeButton
          closeOnClick={false}
          onClose={() => setPopup(null)}
          className="text-foreground"
        >
          <div className="min-w-[10rem] p-0.5">
            <p className="text-sm font-semibold leading-tight">{popup.name}</p>
            {popup.city && <p className="text-muted text-xs">{popup.city}</p>}
            <p className="text-muted mt-1 text-xs">
              {popup.reviews > 0 ? `★ ${popup.rating.toFixed(1)} (${popup.reviews})` : 'No reviews yet'}
              {popup.featured ? ' · Featured' : ''}
            </p>
            <Link
              href={`/dispensary/${popup.slug}`}
              className="text-primary mt-1 inline-block text-xs font-medium hover:underline"
            >
              View dispensary →
            </Link>
          </div>
        </Popup>
      )}
    </Map>
  );
}
