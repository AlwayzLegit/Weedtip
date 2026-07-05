'use client';

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import Link from 'next/link';
import Map, {
  GeolocateControl,
  Layer,
  Marker,
  NavigationControl,
  Popup,
  Source,
  type LayerProps,
  type MapRef,
} from 'react-map-gl';
import type { GeoJSONSource, MapLayerMouseEvent } from 'mapbox-gl';
import { MapPin, Navigation, Store, Truck } from 'lucide-react';
import type { OperatingHours } from '@weedtip/shared';
import type { AdSlotMeta } from './ads/ad-slot-beacon';
import { formatDistance } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BBox } from '@/lib/us-state-bounds';
import { LogoImage } from './logo-image';
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
  /** Paid regional ad slot metadata — the card fires ad_impression/ad_click. */
  adSlot?: AdSlotMeta;
  sponsored?: boolean;
  rating: number;
  reviewCount: number;
  lat: number | null;
  lng: number | null;
  distanceMeters: number | null;
  /** null = unknown (e.g. no hours on file). */
  isOpenNow: boolean | null;
  /**
   * When set (statically rendered pages), the browser recomputes isOpenNow
   * client-side on mount so ISR-cached pages still show a live badge.
   */
  hours?: OperatingHours | null;
  timezone?: string | null;
  /** Short active-deal label for the card ("20% off", "BOGO"). */
  dealBadge?: string | null;
}

/** Pin-sized shop: every match in the viewport gets one of these. */
export interface MapPinPoint {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  featured: boolean;
  isOpenNow: boolean | null;
  /** Featured shops carry their logo → branded logo pin. */
  logoUrl?: string | null;
  /** Live-deal tag rendered on the pin, e.g. "20% off". */
  dealLabel?: string | null;
}

/** How many merchandised pins (logo/deal markers) we'll put in the DOM. */
const MAX_MARKER_PINS = 150;

/** Imperative handle the parent uses to steer the map (geocoder, etc.). */
export interface BrowseMapApi {
  flyTo: (center: { lat: number; lng: number }, zoom?: number) => void;
  fitBounds: (bounds: BBox) => void;
  /** Gentle recenter at the current zoom (mobile card-strip swipes). */
  panTo: (center: { lat: number; lng: number }) => void;
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

// Shop names appear under pins once zoomed in enough to read the streets.
const pinLabelLayer: LayerProps = {
  id: 'pin-labels',
  type: 'symbol',
  minzoom: 12,
  filter: ['!', ['has', 'point_count']],
  layout: {
    'text-field': ['get', 'name'],
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': 11,
    'text-offset': [0, 1.1],
    'text-anchor': 'top',
    'text-max-width': 9,
    'text-optional': true,
  },
  paint: {
    'text-color': '#d7dde4',
    'text-halo-color': '#0b0e13',
    'text-halo-width': 1.2,
  },
};

export function BrowseMap({
  pins,
  initialBounds,
  hoveredSlug,
  selected,
  apiRef,
  onHover,
  onSelect,
  onLoadBounds,
  onMoveEnd,
  onGeolocate,
}: {
  /** Every matching shop in the viewport (clustered client-side). */
  pins: MapPinPoint[];
  /** [minLng, minLat, maxLng, maxLat] the map opens fitted to. */
  initialBounds: BBox;
  hoveredSlug: string | null;
  /** Shop whose popup card is open (must have coords). */
  selected: BrowserShop | null;
  /** Receives an imperative handle for flyTo/fitBounds (geocoder jumps). */
  apiRef?: MutableRefObject<BrowseMapApi | null>;
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

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      flyTo: (center, zoom) =>
        mapRef.current?.flyTo({ center: [center.lng, center.lat], zoom: zoom ?? 12, duration: 1200 }),
      fitBounds: (b) =>
        mapRef.current?.fitBounds([b[0], b[1], b[2], b[3]], { padding: 48, maxZoom: 15, duration: 1200 }),
      panTo: (center) =>
        mapRef.current?.easeTo({ center: [center.lng, center.lat], duration: 500 }),
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Merchandised pins (logo pins for featured shops, deal tags) render as HTML
  // markers so they can carry imagery and stay visible above clusters — the
  // Weedmaps paid-pin behavior. Everything else stays in the clustered layer.
  const markerPins = useMemo(
    () => pins.filter((p) => p.logoUrl || p.dealLabel).slice(0, MAX_MARKER_PINS),
    [pins],
  );
  const geojson = useMemo(() => {
    const markerSlugs = new Set(markerPins.map((p) => p.slug));
    return {
      type: 'FeatureCollection' as const,
      features: pins
        .filter((p) => !markerSlugs.has(p.slug))
        .map((p) => ({
          type: 'Feature' as const,
          properties: { slug: p.slug, name: p.name, featured: p.featured, open: p.isOpenNow },
          geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        })),
    };
  }, [pins, markerPins]);

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
          interactive map. {pins.length.toLocaleString()} location
          {pins.length === 1 ? '' : 's'} in view.
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

  const distance = selected ? formatDistance(selected.distanceMeters) : null;

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
        <Layer {...pinLabelLayer} />
      </Source>

      {/* Merchandised pins: featured logos + deal tags (Weedmaps paid-pin look) */}
      {markerPins.map((p) => (
        <Marker
          key={p.slug}
          latitude={p.lat}
          longitude={p.lng}
          anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            onSelect(p.slug);
          }}
        >
          <div
            role="button"
            tabIndex={0}
            aria-label={p.name}
            onMouseEnter={() => onHover(p.slug)}
            onMouseLeave={() => onHover(null)}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(p.slug)}
            className={cn(
              'flex cursor-pointer flex-col items-center transition-transform',
              hoveredSlug === p.slug && 'scale-110',
            )}
          >
            {p.dealLabel && (
              <span className="bg-primary text-primary-foreground mb-0.5 whitespace-nowrap rounded-full px-1.5 py-px text-[10px] font-bold leading-tight shadow">
                {p.dealLabel}
              </span>
            )}
            {p.logoUrl ? (
              <LogoImage
                src={p.logoUrl}
                name={p.name}
                hideWhenEmpty={false}
                className={cn(
                  'bg-surface h-9 w-9 shadow-md ring-2',
                  hoveredSlug === p.slug ? 'ring-primary' : 'ring-amber-400',
                )}
                rounded="rounded-full"
              />
            ) : (
              <span
                aria-hidden
                className={cn(
                  'block h-3.5 w-3.5 rounded-full border-2 border-black/70 shadow',
                  p.featured ? 'bg-amber-400' : p.isOpenNow === false ? 'bg-slate-500' : 'bg-primary',
                )}
              />
            )}
          </div>
        </Marker>
      ))}

      {selected && typeof selected.lat === 'number' && typeof selected.lng === 'number' && (
        <Popup
          latitude={selected.lat}
          longitude={selected.lng}
          anchor="bottom"
          offset={14}
          closeButton
          closeOnClick={false}
          onClose={() => onSelect(null)}
          maxWidth="288px"
          className="browse-popup"
        >
          <div className="w-[17rem]">
            <Link href={`/dispensary/${selected.slug}`} prefetch={false} className="block">
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
                {distance && (
                  <span className="bg-background/85 text-foreground absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium">
                    {distance}
                  </span>
                )}
              </MediaImage>
              <div className="space-y-1 p-3 pb-2">
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
                <p className="text-muted flex items-center gap-2 text-[11px]">
                  {selected.isPickup && (
                    <span className="inline-flex items-center gap-0.5">
                      <Store className="h-3 w-3" /> Pickup
                    </span>
                  )}
                  {selected.isDelivery && (
                    <span className="inline-flex items-center gap-0.5">
                      <Truck className="h-3 w-3" /> Delivery
                    </span>
                  )}
                </p>
              </div>
            </Link>
            <div className="flex items-center gap-3 px-3 pb-2.5">
              <Link
                href={`/dispensary/${selected.slug}`}
                prefetch={false}
                className="text-primary text-xs font-semibold hover:underline"
              >
                View menu →
              </Link>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted hover:text-foreground inline-flex items-center gap-1 text-xs font-medium"
              >
                <Navigation className="h-3 w-3" /> Directions
              </a>
            </div>
          </div>
        </Popup>
      )}
    </Map>
  );
}
