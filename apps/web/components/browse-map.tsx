'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Map, {
  GeolocateControl,
  Layer,
  NavigationControl,
  Popup,
  Source,
  type LayerProps,
  type MapRef,
} from 'react-map-gl';
import type { GeoJSONSource, MapLayerMouseEvent } from 'mapbox-gl';
import { MapPin } from 'lucide-react';
import type { OperatingHours } from '@weedtip/shared';
import type { BBox } from '@/lib/us-state-bounds';
import { MediaImage } from './media-image';
import { RatingStars } from './rating-stars';
import 'mapbox-gl/dist/mapbox-gl.css';

/** One dispensary as the map-first finder sees it (compact card shape). */
export interface BrowserShop {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string;
  coverImageUrl: string | null;
  logoUrl: string | null;
  isDelivery: boolean;
  isPickup: boolean;
  isMedical: boolean;
  isRecreational: boolean;
  featured: boolean;
  placementId?: string;
  rating: number;
  reviewCount: number;
  lat: number | null;
  lng: number | null;
  distanceMeters: number | null;
  /** null = unknown (e.g. no hours on file). */
  isOpenNow: boolean | null;
  /**
   * When set (statically rendered pages), the browser recomputes isOpenNow
   * client-side on mount so ISR-cached HTML still shows a live badge.
   */
  hours?: OperatingHours | null;
  timezone?: string | null;
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

// Closed shops fade to slate; featured stay amber; open/unknown are brand green.
const unclusteredLayer: LayerProps = {
  id: 'unclustered-point',
  type: 'circle',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-color': [
      'case',
      ['get', 'featured'],
      '#fbbf24',
      ['==', ['get', 'open'], false],
      '#64748b',
      '#34d399',
    ],
    'circle-radius': ['case', ['get', 'featured'], 7, 6],
    'circle-stroke-width': 1.5,
    'circle-stroke-color': '#0b0b0b',
  },
};

export function BrowseMap({
  shops,
  initialBounds,
  hoveredSlug,
  selected,
  onHover,
  onSelect,
  onLoadBounds,
  onMoveEnd,
  onGeolocate,
}: {
  shops: BrowserShop[];
  /** [minLng, minLat, maxLng, maxLat] the map opens fitted to. */
  initialBounds: BBox;
  hoveredSlug: string | null;
  /** Shop whose popup card is open (must have coords). */
  selected: BrowserShop | null;
  onHover: (slug: string | null) => void;
  onSelect: (slug: string | null) => void;
  /** Fires once with the fitted viewport when the map finishes loading. */
  onLoadBounds: (bounds: BBox) => void;
  /** Fires with the visible bbox after any pan/zoom settles. */
  onMoveEnd: (bounds: BBox) => void;
  onGeolocate?: (coords: { lat: number; lng: number }) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [overInteractive, setOverInteractive] = useState(false);
  const mapRef = useRef<MapRef>(null);
  useEffect(() => setMounted(true), []);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: shops
        .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
        .map((s) => ({
          type: 'Feature' as const,
          properties: { slug: s.slug, featured: s.featured, open: s.isOpenNow },
          geometry: { type: 'Point' as const, coordinates: [s.lng as number, s.lat as number] },
        })),
    }),
    [shops],
  );

  // List-hover → pin highlight: a ring drawn under the hovered shop's pin.
  const highlightLayer: LayerProps = useMemo(
    () => ({
      id: 'hovered-point',
      type: 'circle',
      filter: [
        'all',
        ['!', ['has', 'point_count']],
        ['==', ['get', 'slug'], hoveredSlug ?? '__none__'],
      ],
      paint: {
        'circle-radius': 11,
        'circle-color': '#34d399',
        'circle-opacity': 0.35,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#34d399',
      },
    }),
    [hoveredSlug],
  );

  if (!mounted) return <div className="bg-surface-2 h-full w-full animate-pulse" />;

  if (!token) {
    return (
      <div className="bg-surface-2 flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
        <MapPin className="text-muted h-8 w-8" />
        <p className="text-sm font-medium">Map preview</p>
        <p className="text-muted max-w-xs text-xs">
          Set <code className="text-primary">NEXT_PUBLIC_MAPBOX_TOKEN</code> to enable the
          interactive map. {shops.length.toLocaleString()} location
          {shops.length === 1 ? '' : 's'} in view.
        </p>
      </div>
    );
  }

  const onClick = (e: MapLayerMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature) {
      onSelect(null);
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
    } else if (feature.properties?.slug) {
      onSelect(feature.properties.slug as string);
    }
  };

  const onMouseMove = (e: MapLayerMouseEvent) => {
    setOverInteractive(Boolean(e.features?.length));
    const pin = e.features?.find((f) => f.layer?.id === 'unclustered-point');
    onHover(pin ? ((pin.properties?.slug as string) ?? null) : null);
  };

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={token}
      initialViewState={{
        bounds: initialBounds,
        fitBoundsOptions: { padding: 48, maxZoom: 15 },
      }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      style={{ width: '100%', height: '100%' }}
      interactiveLayerIds={['clusters', 'unclustered-point']}
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseLeave={() => {
        setOverInteractive(false);
        onHover(null);
      }}
      onLoad={(e) => {
        // The fitted viewport differs from initialBounds (aspect + padding);
        // report it so "Search this area" compares against what's really shown.
        const b = e.target.getBounds();
        if (b) onLoadBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      }}
      onMoveEnd={(e) => {
        const b = e.target.getBounds();
        if (b) onMoveEnd([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      }}
      cursor={overInteractive ? 'pointer' : 'grab'}
    >
      <NavigationControl position="top-right" showCompass={false} />
      <GeolocateControl
        position="top-right"
        trackUserLocation={false}
        onGeolocate={(e) => onGeolocate?.({ lat: e.coords.latitude, lng: e.coords.longitude })}
      />

      <Source
        id="dispensaries"
        type="geojson"
        data={geojson}
        cluster
        clusterMaxZoom={13}
        clusterRadius={50}
      >
        <Layer {...highlightLayer} />
        <Layer {...clusterLayer} />
        <Layer {...clusterCountLayer} />
        <Layer {...unclusteredLayer} />
      </Source>

      {selected && typeof selected.lat === 'number' && typeof selected.lng === 'number' && (
        <Popup
          latitude={selected.lat}
          longitude={selected.lng}
          anchor="bottom"
          offset={14}
          closeButton
          closeOnClick={false}
          onClose={() => onSelect(null)}
          maxWidth="272px"
          className="browse-popup"
        >
          <Link href={`/dispensary/${selected.slug}`} prefetch={false} className="block w-64">
            <MediaImage
              url={selected.coverImageUrl}
              alt={selected.name}
              className="h-28"
              iconClassName="h-8 w-8"
            >
              {selected.isOpenNow !== null && (
                <span
                  className={
                    selected.isOpenNow
                      ? 'bg-background/85 text-primary absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold'
                      : 'bg-background/85 text-muted absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold'
                  }
                >
                  {selected.isOpenNow ? 'Open now' : 'Closed'}
                </span>
              )}
            </MediaImage>
            <div className="space-y-1 p-3">
              <p className="text-sm font-semibold leading-tight">{selected.name}</p>
              <p className="text-muted text-xs">
                {selected.city ? `${selected.city}, ${selected.state}` : 'Delivery only'}
              </p>
              {selected.rating > 0 && (
                <p className="flex items-center gap-1 text-xs">
                  <RatingStars rating={selected.rating} size={12} />
                  <span className="text-muted">
                    {selected.rating.toFixed(1)}
                    {selected.reviewCount ? ` (${selected.reviewCount})` : ''}
                  </span>
                </p>
              )}
              <span className="text-primary inline-block pt-0.5 text-xs font-semibold">
                View menu →
              </span>
            </div>
          </Link>
        </Popup>
      )}
    </Map>
  );
}
