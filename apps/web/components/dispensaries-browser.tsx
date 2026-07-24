'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, RotateCw, SlidersHorizontal } from 'lucide-react';
import {
  AMENITY_GROUPS,
  AMENITY_LABELS,
  type Amenity,
  type DispensarySort,
  type OperatingHours,
} from '@weedtip/shared';
import { mapPinsBounds, searchDispensariesBounds } from '@weedtip/supabase/queries';
import { dealBadge, formatDistance, isOpenNow } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { US_BOUNDS, type BBox } from '@/lib/us-state-bounds';
import { track } from '@/lib/analytics';
import type { BrowseMapApi, BrowserShop, MapPinPoint } from './browse-map';
import { DispensaryResultRow } from './dispensary-result-row';
import { GeoSearch, type GeoPlace } from './geo-search';
import { MapBottomSheet, type SheetSnap } from './map-bottom-sheet';
import { MapResultsMirror } from './map-results-mirror';
import { MediaImage } from './media-image';
import { RowQuickActions } from './row-quick-actions';

export type { BrowserShop };

// Code-split the Mapbox GL bundle (~200KB) out of the initial chunk: it's
// client-only and heavy, so load it on the client after first paint. The list
// panel is usable immediately; the map area shows a neutral placeholder.
const BrowseMap = dynamic(() => import('./browse-map').then((m) => m.BrowseMap), {
  ssr: false,
  loading: () => <div className="bg-surface-2 h-full w-full animate-pulse" aria-hidden />,
});

export type BrowseFilters = {
  openNow: boolean;
  pickup: boolean;
  delivery: boolean;
  deals: boolean;
  medical: boolean;
  recreational: boolean;
  amenities: Amenity[];
  sort: DispensarySort;
  query: string;
  /** No UI of its own — preserved across searches for ?category= deep links. */
  categorySlug?: string;
};

export const EMPTY_FILTERS: BrowseFilters = {
  openNow: false,
  pickup: false,
  delivery: false,
  deals: false,
  medical: false,
  recreational: false,
  amenities: [],
  sort: 'default',
  query: '',
};

const PILLS = [
  { key: 'openNow', label: 'Open now' },
  { key: 'deals', label: 'Deals' },
  { key: 'pickup', label: 'Pickup' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'medical', label: 'Medical' },
  { key: 'recreational', label: 'Rec' },
] as const;

const PAGE_SIZE = 60;

/** Has the viewport moved enough since the last search to offer "Search this area"? */
function boundsChanged(prev: BBox, next: BBox): boolean {
  const spanLng = Math.max(prev[2] - prev[0], 1e-6);
  const spanLat = Math.max(prev[3] - prev[1], 1e-6);
  const shift = Math.max(
    Math.abs((prev[0] + prev[2]) / 2 - (next[0] + next[2]) / 2) / spanLng,
    Math.abs((prev[1] + prev[3]) / 2 - (next[1] + next[3]) / 2) / spanLat,
  );
  const zoom = Math.max(
    (next[2] - next[0]) / spanLng,
    spanLng / Math.max(next[2] - next[0], 1e-6),
    (next[3] - next[1]) / spanLat,
    spanLat / Math.max(next[3] - next[1], 1e-6),
  );
  return shift > 0.12 || zoom > 1.3;
}

type RpcRow = {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  cover_image_url: string;
  logo_url: string;
  is_medical: boolean;
  is_recreational: boolean;
  is_delivery: boolean;
  is_pickup: boolean;
  latitude: number;
  longitude: number;
  featured: boolean;
  rating_avg: number;
  rating_count: number;
  licensed: boolean;
  distance_meters: number;
  is_open_now: boolean;
  paid_tier?: number;
  total_count: number;
};

function toShop(r: RpcRow): BrowserShop {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    city: r.city,
    state: r.state,
    coverImageUrl: r.cover_image_url,
    logoUrl: r.logo_url,
    isDelivery: r.is_delivery,
    isPickup: r.is_pickup,
    isMedical: r.is_medical,
    isRecreational: r.is_recreational,
    featured: r.featured,
    // Paying subscribers/placements get the Sponsored treatment (merchandised
    // ranking). `?? 0` keeps this safe until the ranking migration is applied.
    sponsored: (r.paid_tier ?? 0) > 0,
    rating: r.rating_avg,
    reviewCount: r.rating_count,
    licensed: r.licensed,
    lat: r.latitude,
    lng: r.longitude,
    distanceMeters: r.distance_meters,
    isOpenNow: r.is_open_now,
  };
}

/**
 * Map-first discovery (Weedmaps/Google Maps pattern): scrollable result list
 * beside a sticky full-height map of the same result set. The map viewport IS
 * the query — panning/zooming offers "Search this area", filter pills re-query
 * the server (search_dispensaries_bounds RPC), and pins ↔ cards highlight each
 * other on hover. Mobile is map-first: a draggable bottom sheet (peek carousel
 * → half → full list) overlays the full-bleed map.
 *
 * `variant="page"` fills the viewport below the navbar (/dispensaries);
 * `variant="embedded"` is a fixed-height block inside a longer page (city pages).
 */
export function DispensariesBrowser({
  initialShops,
  initialTotal,
  initialBounds,
  initialFilters = EMPTY_FILTERS,
  initialOrigin = null,
  heading,
  variant = 'page',
  syncUrl = false,
  noun = { one: 'dispensary', many: 'dispensaries' },
}: {
  initialShops: BrowserShop[];
  initialTotal: number;
  initialBounds: BBox;
  initialFilters?: BrowseFilters;
  initialOrigin?: { lat: number; lng: number } | null;
  heading?: string;
  variant?: 'page' | 'embedded';
  syncUrl?: boolean;
  /** What one result is called — e.g. delivery pages pass "delivery service". */
  noun?: { one: string; many: string };
}) {
  const supabase = useMemo(() => createClient(), []);

  const [filters, setFilters] = useState<BrowseFilters>(initialFilters);
  const [shops, setShops] = useState<BrowserShop[]>(initialShops);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [origin, setOrigin] = useState(initialOrigin);
  const [hovered, setHovered] = useState<string | null>(null);
  const [popupShop, setPopupShop] = useState<BrowserShop | null>(null);
  // Mobile map-first sheet: starts at the shallow "peek" (carousel over the map).
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('peek');
  const [showMore, setShowMore] = useState(false);
  const [areaChanged, setAreaChanged] = useState(false);
  // A text search that missed nearby was retried nationwide — the result set is
  // no longer "in this area", so the header says so instead of silently lying.
  const [widened, setWidened] = useState(false);
  // Google Maps-style "search as I move": on by default, persisted per browser.
  const [autoSearch, setAutoSearch] = useState(true);
  // Row-level Save: the signed-in user's favorite set, loaded once. null user
  // → hearts route to sign-in.
  const [userId, setUserId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  // Every matching shop in the viewport (the list stays paginated).
  const [pins, setPins] = useState<MapPinPoint[]>(() =>
    initialShops
      .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
      .map((s) => ({
        slug: s.slug,
        name: s.name,
        lat: s.lat as number,
        lng: s.lng as number,
        featured: s.featured || !!s.sponsored,
        sponsored: !!s.sponsored,
        isOpenNow: s.isOpenNow,
        logoUrl: s.featured || s.sponsored ? s.logoUrl : null,
        dealLabel: s.dealBadge ?? null,
        deliveryOnly: !!s.isDelivery && !s.isPickup,
      })),
  );

  // List position by slug: cards and map pins share Google-Maps-style result
  // numbers, so the paid-first ordering (featured → rank → distance) is visible.
  // Viewport pins beyond the paginated list simply carry no number.
  const rankBySlug = useMemo(() => new Map(shops.map((s, i) => [s.slug, i + 1])), [shops]);
  const rankedPins = useMemo(
    () =>
      pins.map((p) => {
        const rank = rankBySlug.get(p.slug);
        return rank ? { ...p, rank } : p;
      }),
    [pins, rankBySlug],
  );

  // Sponsored shops in view feed the on-map rotating ad card (T1). Capped so a
  // dense metro doesn't rotate through dozens; ordered as the result set is
  // (paid-first ranking already applied server-side).
  const promoAds = useMemo(
    () =>
      shops
        .filter((s) => s.sponsored && typeof s.lat === 'number' && typeof s.lng === 'number')
        .slice(0, 6)
        .map((s) => ({
          slug: s.slug,
          name: s.name,
          coverImageUrl: s.coverImageUrl,
          logoUrl: s.logoUrl,
          rating: s.rating,
          reviewCount: s.reviewCount,
          distanceMeters: s.distanceMeters,
          dealBadge: s.dealBadge ?? null,
          lat: s.lat as number,
          lng: s.lng as number,
        })),
    [shops],
  );

  // The bbox the current result set was searched with vs. what the map shows now.
  // Statically rendered callers (ISR city pages) pass hours/timezone instead of
  // a server-computed open flag; compute it live on mount so the badge is fresh.
  useEffect(() => {
    setShops((prev) =>
      prev.map((s) =>
        s.hours !== undefined ? { ...s, isOpenNow: isOpenNow(s.hours, s.timezone ?? null) } : s,
      ),
    );
  }, []);

  const searchedBounds = useRef<BBox>(initialBounds);
  const viewBounds = useRef<BBox>(initialBounds);
  const autoSearchNextMove = useRef(false);
  const moveDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const requestId = useRef(0);
  const pinsRequestId = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  // The mobile sheet renders its own copy of the list, so it keeps a separate
  // card-ref map (a shared map would have both DOM trees fight over each slug).
  const sheetCardRefs = useRef(new Map<string, HTMLDivElement>());
  const stripRef = useRef<HTMLDivElement>(null);
  const stripCardRefs = useRef(new Map<string, HTMLAnchorElement>());
  const stripScrollDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stripProgrammatic = useRef(false);
  const mapApi = useRef<BrowseMapApi | null>(null);
  // T10 deep-link: a ?sel= slug from the opening URL, consumed once the map has
  // loaded so a shared link reopens that store's popup. selectFnRef defers to
  // the latest handleSelect without an ordering dependency.
  const restoreSelRef = useRef<string | null>(
    typeof window !== 'undefined' && syncUrl
      ? new URLSearchParams(window.location.search).get('sel')
      : null,
  );
  const selectFnRef = useRef<(slug: string | null) => void>(() => {});

  // Mobile map view: swiping the bottom card strip highlights + recenters on
  // the card closest to the strip's center (Weedmaps' mobile pattern).
  const handleStripScroll = useCallback(() => {
    if (stripProgrammatic.current) return;
    clearTimeout(stripScrollDebounce.current);
    stripScrollDebounce.current = setTimeout(() => {
      const strip = stripRef.current;
      if (!strip) return;
      const center = strip.scrollLeft + strip.clientWidth / 2;
      let best: { slug: string; dist: number } | null = null;
      for (const [slug, el] of stripCardRefs.current) {
        const mid = el.offsetLeft + el.offsetWidth / 2;
        const dist = Math.abs(mid - center);
        if (!best || dist < best.dist) best = { slug, dist };
      }
      if (!best) return;
      const shop = shops.find((s) => s.slug === best.slug);
      if (!shop) return;
      setHovered(shop.slug);
      if (typeof shop.lat === 'number' && typeof shop.lng === 'number') {
        mapApi.current?.panTo({ lat: shop.lat, lng: shop.lng });
      }
    }, 180);
  }, [shops]);

  useEffect(() => {
    const stored = window.localStorage.getItem('wt_map_autosearch');
    if (stored !== null) setAutoSearch(stored === '1');
  }, []);
  const toggleAutoSearch = () => {
    setAutoSearch((v) => {
      window.localStorage.setItem('wt_map_autosearch', v ? '0' : '1');
      return !v;
    });
  };

  const fetchPins = useCallback(
    async (bounds: BBox, nextFilters: BrowseFilters) => {
      const id = ++pinsRequestId.current;
      const { data } = await mapPinsBounds(supabase, {
        min_lng: bounds[0],
        min_lat: bounds[1],
        max_lng: bounds[2],
        max_lat: bounds[3],
        query: nextFilters.query || undefined,
        is_delivery: nextFilters.delivery || undefined,
        is_pickup: nextFilters.pickup || undefined,
        is_medical: nextFilters.medical || undefined,
        is_recreational: nextFilters.recreational || undefined,
        open_now: nextFilters.openNow || undefined,
        has_deals: nextFilters.deals || undefined,
        category_slug: nextFilters.categorySlug,
        amenities: nextFilters.amenities.length ? nextFilters.amenities : undefined,
      });
      if (id !== pinsRequestId.current || !data) return;
      setPins(
        data.map((r) => ({
          slug: r.slug,
          name: r.name,
          lat: r.latitude,
          lng: r.longitude,
          // Paid shops share the featured pin treatment (server decides logo_url).
          featured: r.featured || ((r as { paid?: boolean }).paid ?? false),
          sponsored: (r as { paid?: boolean }).paid ?? false,
          isOpenNow: r.is_open_now,
          logoUrl: r.logo_url,
          dealLabel: r.deal_type ? dealBadge(r.deal_type, Number(r.deal_value)) : null,
          deliveryOnly: r.delivery_only,
        })),
      );
    },
    [supabase],
  );

  // Initial render only carries the first page of pins — swap in the full
  // viewport's pins as soon as we're client-side.
  useEffect(() => {
    void fetchPins(initialBounds, initialFilters);
  }, []);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      void supabase
        .from('favorites')
        .select('dispensary_id')
        .eq('user_id', data.user.id)
        .then(({ data: favs }) => setFavorites(new Set((favs ?? []).map((f) => f.dispensary_id))));
    });
  }, [supabase]);

  // Optimistic heart toggle straight through RLS (favorites_*_self policies);
  // reverts on failure. Signed-out users go to sign-in and come back here.
  const toggleFavorite = useCallback(
    (dispensaryId: string, slug: string) => {
      if (!userId) {
        window.location.href = `/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      const adding = !favorites.has(dispensaryId);
      setFavorites((prev) => {
        const next = new Set(prev);
        if (adding) next.add(dispensaryId);
        else next.delete(dispensaryId);
        return next;
      });
      track(adding ? 'favorite_added' : 'favorite_removed', {
        kind: 'dispensary',
        dispensary_id: dispensaryId,
        slug,
        surface: 'map_list',
      });
      const op = adding
        ? supabase.from('favorites').insert({ user_id: userId, dispensary_id: dispensaryId })
        : supabase
            .from('favorites')
            .delete()
            .eq('user_id', userId)
            .eq('dispensary_id', dispensaryId);
      void op.then(({ error }) => {
        if (error) {
          setFavorites((prev) => {
            const next = new Set(prev);
            if (adding) next.delete(dispensaryId);
            else next.add(dispensaryId);
            return next;
          });
        }
      });
    },
    [userId, favorites, supabase],
  );

  const runSearch = useCallback(
    async function run(
      bounds: BBox,
      nextFilters: BrowseFilters,
      opts: {
        append?: boolean;
        offset?: number;
        origin?: { lat: number; lng: number } | null;
        /** Set on the automatic nationwide retry after a zero-result text search. */
        widened?: boolean;
      },
    ) {
      const id = ++requestId.current;
      setLoading(true);
      setFailed(false);
      const o = opts.origin === undefined ? origin : opts.origin;
      const { data, error } = await searchDispensariesBounds(supabase, {
        min_lng: bounds[0],
        min_lat: bounds[1],
        max_lng: bounds[2],
        max_lat: bounds[3],
        query: nextFilters.query || undefined,
        is_delivery: nextFilters.delivery || undefined,
        is_pickup: nextFilters.pickup || undefined,
        is_medical: nextFilters.medical || undefined,
        is_recreational: nextFilters.recreational || undefined,
        open_now: nextFilters.openNow || undefined,
        has_deals: nextFilters.deals || undefined,
        category_slug: nextFilters.categorySlug,
        amenities: nextFilters.amenities.length ? nextFilters.amenities : undefined,
        origin_lat: o?.lat,
        origin_lng: o?.lng,
        sort: nextFilters.sort,
        limit: PAGE_SIZE,
        offset: opts.offset ?? 0,
      });
      if (id !== requestId.current) return; // a newer search superseded this one
      setLoading(false);
      if (error) {
        setFailed(true);
        return;
      }
      const rows = (data ?? []).map(toShop);
      // A text search that misses in the current viewport retries nationwide
      // (Weedmaps behavior) — the shop the user typed is usually just outside
      // the visible area, and "0 results" for a real shop reads as broken.
      if (
        !opts.append &&
        !opts.widened &&
        rows.length === 0 &&
        (nextFilters.query ?? '').trim() &&
        boundsChanged(bounds, US_BOUNDS)
      ) {
        void run(US_BOUNDS, nextFilters, { ...opts, widened: true });
        return;
      }
      setTotal(data?.[0]?.total_count ?? (opts.append ? total : 0));
      setShops((prev) => (opts.append ? [...prev, ...rows] : rows));
      if (!opts.append) setWidened(!!opts.widened && rows.length > 0);
      // The widened pass found matches elsewhere — bring them into view.
      if (opts.widened && rows.length > 0) {
        const pts = rows.filter((r) => typeof r.lat === 'number' && typeof r.lng === 'number');
        if (pts.length > 0) {
          const lngs = pts.map((p) => p.lng as number);
          const lats = pts.map((p) => p.lat as number);
          autoSearchNextMove.current = false;
          mapApi.current?.fitBounds([
            Math.min(...lngs),
            Math.min(...lats),
            Math.max(...lngs),
            Math.max(...lats),
          ]);
        }
      }
      // Deal badges for the visible page of results (soonest-ending live deal
      // per shop) — the bounds RPC itself stays lean.
      if (rows.length > 0) {
        const nowIso = new Date().toISOString();
        void supabase
          .from('deals')
          .select('dispensary_id,discount_type,discount_value')
          .in(
            'dispensary_id',
            rows.map((r) => r.id),
          )
          .eq('is_active', true)
          .lte('start_date', nowIso)
          .gte('end_date', nowIso)
          .order('end_date')
          .then(({ data: liveDeals }) => {
            if (id !== requestId.current || !liveDeals?.length) return;
            const byShop = new Map<string, string>();
            for (const dl of liveDeals) {
              if (dl.dispensary_id && !byShop.has(dl.dispensary_id)) {
                byShop.set(
                  dl.dispensary_id,
                  dealBadge(dl.discount_type, Number(dl.discount_value)),
                );
              }
            }
            if (byShop.size === 0) return;
            setShops((prev) =>
              prev.map((sh) => (byShop.has(sh.id) ? { ...sh, dealBadge: byShop.get(sh.id) } : sh)),
            );
          });
      }
      if (!opts.append) {
        setPopupShop(null);
        listRef.current?.scrollTo({ top: 0 });
        void fetchPins(bounds, nextFilters);
      }
      searchedBounds.current = bounds;
      setAreaChanged(false);
    },
    [supabase, origin, total, fetchPins],
  );

  // Reflect filters into the URL (share/refresh keeps state) without a server nav.
  const syncFiltersToUrl = useCallback(
    (f: BrowseFilters) => {
      if (!syncUrl || typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const setBool = (key: string, on: boolean) =>
        on ? params.set(key, 'true') : params.delete(key);
      setBool('open_now', f.openNow);
      setBool('has_deals', f.deals);
      setBool('is_pickup', f.pickup);
      setBool('is_delivery', f.delivery);
      setBool('is_medical', f.medical);
      setBool('is_recreational', f.recreational);
      if (f.query) params.set('query', f.query);
      else params.delete('query');
      if (f.amenities.length) params.set('amenities', f.amenities.join(','));
      else params.delete('amenities');
      if (f.sort !== 'default') params.set('sort', f.sort);
      else params.delete('sort');
      params.delete('page');
      const qs = params.toString();
      window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    },
    [syncUrl],
  );

  // Reflect the map viewport (center + rough radius) into the URL so a shared
  // or refreshed link reopens at the same place/zoom, like Google Maps. The
  // page reads lat/lng/radius_meters to seed the opening bounds, so we write
  // those and drop the now-stale place/state labels once the user has panned.
  const syncViewportToUrl = useCallback(
    (bounds: BBox) => {
      if (!syncUrl || typeof window === 'undefined') return;
      const [minLng, minLat, maxLng, maxLat] = bounds;
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;
      // Half the vertical span in metres approximates the visible radius;
      // clamp to the range the page accepts.
      const radius = Math.min(Math.max(((maxLat - minLat) / 2) * 111_320, 2_000), 160_000);
      const params = new URLSearchParams(window.location.search);
      params.set('lat', centerLat.toFixed(5));
      params.set('lng', centerLng.toFixed(5));
      params.set('radius_meters', String(Math.round(radius)));
      params.delete('place');
      params.delete('state');
      const qs = params.toString();
      window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    },
    [syncUrl],
  );

  const applyFilters = useCallback(
    (patch: Partial<BrowseFilters>) => {
      const next = { ...filters, ...patch };
      setFilters(next);
      syncFiltersToUrl(next);
      void runSearch(viewBounds.current, next, {});
    },
    [filters, runSearch, syncFiltersToUrl],
  );

  // "Nearest" needs a reference point. When none is known yet, ask the browser
  // for one on selection (the Google/Weedmaps pattern) instead of hiding the
  // option; a denied prompt still applies the sort, which then falls back to
  // the default order server-side.
  const handleSortChange = useCallback(
    (value: DispensarySort) => {
      if (
        value === 'distance' &&
        !origin &&
        typeof navigator !== 'undefined' &&
        navigator.geolocation
      ) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const o = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setOrigin(o);
            const next = { ...filters, sort: value };
            setFilters(next);
            syncFiltersToUrl(next);
            void runSearch(viewBounds.current, next, { origin: o });
          },
          () => applyFilters({ sort: value }),
          { enableHighAccuracy: false, timeout: 8000 },
        );
        return;
      }
      applyFilters({ sort: value });
    },
    [origin, filters, runSearch, syncFiltersToUrl, applyFilters],
  );

  // The map fits initialBounds to its own aspect ratio, so the viewport it
  // actually shows is wider than what we searched — treat that as the baseline.
  const handleLoadBounds = useCallback(
    (bounds: BBox) => {
      viewBounds.current = bounds;
      searchedBounds.current = bounds;
      // Restore a deep-linked selection once (map is ready): open its popup and
      // fly to frame it. Falls back to just opening the popup if it's off-page.
      const sel = restoreSelRef.current;
      if (sel) {
        restoreSelRef.current = null;
        selectFnRef.current(sel);
        const s = shops.find((x) => x.slug === sel);
        if (s && typeof s.lat === 'number' && typeof s.lng === 'number') {
          mapApi.current?.flyTo({ lat: s.lat, lng: s.lng }, 14);
        }
      }
    },
    [shops],
  );

  const handleMoveEnd = useCallback(
    (bounds: BBox) => {
      viewBounds.current = bounds;
      syncViewportToUrl(bounds);
      if (autoSearchNextMove.current) {
        autoSearchNextMove.current = false;
        void runSearch(bounds, filters, {});
        return;
      }
      if (autoSearch) {
        // Debounced so a chain of pans/zooms settles into one query.
        clearTimeout(moveDebounce.current);
        if (boundsChanged(searchedBounds.current, bounds)) {
          moveDebounce.current = setTimeout(() => void runSearch(bounds, filters, {}), 400);
        }
        return;
      }
      setAreaChanged(boundsChanged(searchedBounds.current, bounds));
    },
    [filters, runSearch, autoSearch, syncViewportToUrl],
  );

  const handleGeolocate = useCallback((coords: { lat: number; lng: number }) => {
    setOrigin(coords);
    // Knowing where the user is, default to nearest-first (T8). The locate
    // control flies the map; the resulting moveend re-searches the landed
    // viewport with the new origin + distance sort.
    setFilters((f) => (f.sort === 'distance' ? f : { ...f, sort: 'distance' }));
    autoSearchNextMove.current = true;
  }, []);

  // Geocoder pick: fly the map to the place; the resulting moveend re-searches.
  const handlePlace = useCallback((place: GeoPlace) => {
    autoSearchNextMove.current = true;
    if (place.bbox) mapApi.current?.fitBounds(place.bbox);
    else mapApi.current?.flyTo(place.center, 12);
  }, []);

  // Bring the mobile strip card for a slug into view without re-triggering the
  // scroll-settle handler (which would pan the map back).
  const scrollStripTo = useCallback((slug: string) => {
    const el = stripCardRefs.current.get(slug);
    if (!el) return;
    stripProgrammatic.current = true;
    el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    setTimeout(() => {
      stripProgrammatic.current = false;
    }, 600);
  }, []);

  // Map pin click → popup. Pins cover the whole viewport, so the shop may not
  // be in the paginated list — fetch its card data by slug when it isn't.
  const handleSelect = useCallback(
    (slug: string | null) => {
      if (!slug) {
        setPopupShop(null);
        return;
      }
      scrollStripTo(slug);
      // Raise the tapped shop's card: centered in the peek carousel (above) and
      // to the top of both list copies (desktop panel + expanded mobile sheet).
      sheetCardRefs.current.get(slug)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      const inList = shops.find((s) => s.slug === slug);
      if (inList) {
        setPopupShop(inList);
        cardRefs.current.get(slug)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }
      void (async () => {
        const { data } = await supabase
          .from('dispensaries')
          .select(
            'id,slug,name,city,state,cover_image_url,logo_url,is_delivery,is_pickup,is_medical,is_recreational,featured,rating_avg,rating_count,latitude,longitude,hours,timezone,license_number',
          )
          .eq('slug', slug)
          .eq('status', 'active')
          .maybeSingle();
        if (!data) return;
        const hours = (data.hours ?? null) as OperatingHours | null;
        setPopupShop({
          id: data.id,
          slug: data.slug,
          name: data.name,
          city: data.city,
          state: data.state,
          coverImageUrl: data.cover_image_url,
          logoUrl: data.logo_url,
          isDelivery: data.is_delivery,
          isPickup: data.is_pickup,
          isMedical: data.is_medical,
          isRecreational: data.is_recreational,
          featured: data.featured,
          rating: data.rating_avg,
          reviewCount: data.rating_count,
          licensed: !!data.license_number,
          lat: data.latitude,
          lng: data.longitude,
          distanceMeters: null,
          isOpenNow: hours ? isOpenNow(hours, data.timezone) : null,
        });
      })();
    },
    [shops, supabase, scrollStripTo],
  );
  selectFnRef.current = handleSelect;

  // T10 deep-link: reflect the open store into the URL (?sel=slug) so a shared
  // or refreshed link reopens the same popup. Composes with the filter/viewport
  // writers — they preserve unrelated params.
  useEffect(() => {
    if (!syncUrl || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (popupShop) params.set('sel', popupShop.slug);
    else params.delete('sel');
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [popupShop, syncUrl]);

  const pillClass = (active: boolean) =>
    cn(
      'focus-visible:ring-primary shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2',
      active
        ? 'border-primary bg-primary-muted text-primary'
        : 'border-border text-muted hover:text-foreground',
    );

  const filtersBar = (
    <div className="border-border bg-background/95 border-b px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {heading && (
          <h1 className="hidden shrink-0 text-lg font-bold sm:block" data-testid="browse-heading">
            {heading}
          </h1>
        )}
        <GeoSearch
          initialQuery={filters.query}
          onSubmitQuery={(q) => applyFilters({ query: q })}
          onPlace={handlePlace}
          className="w-full sm:w-auto sm:min-w-0 sm:max-w-xs sm:flex-1"
        />
        <div className="scrollbar-none -my-1 flex w-full min-w-0 items-center gap-2 overflow-x-auto py-1 sm:w-auto sm:flex-1">
          {PILLS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => applyFilters({ [key]: !filters[key] })}
              className={pillClass(filters[key])}
              aria-pressed={filters[key]}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className={pillClass(showMore || filters.amenities.length > 0)}
            aria-expanded={showMore}
          >
            <SlidersHorizontal className="mr-1 inline h-3.5 w-3.5" />
            More{filters.amenities.length > 0 ? ` (${filters.amenities.length})` : ''}
          </button>
          <select
            value={filters.sort}
            onChange={(e) => handleSortChange(e.target.value as DispensarySort)}
            className="border-border bg-surface h-9 shrink-0 rounded-full border px-3 text-sm"
            aria-label="Sort by"
          >
            <option value="default">Sort: Recommended</option>
            <option value="rating">Top rated</option>
            <option value="reviewed">Most reviewed</option>
            <option value="distance">Nearest</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </div>
      </div>

      {showMore && (
        <div className="mt-3 space-y-3">
          {filters.amenities.length > 0 && (
            <button
              type="button"
              onClick={() => applyFilters({ amenities: [] })}
              className="text-primary text-xs hover:underline"
            >
              Clear all
            </button>
          )}
          {AMENITY_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-muted mb-1.5 text-xs font-semibold uppercase tracking-wide">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.items.map((item) => {
                  const active = filters.amenities.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() =>
                        applyFilters({
                          amenities: active
                            ? filters.amenities.filter((a) => a !== item)
                            : [...filters.amenities, item],
                        })
                      }
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        active
                          ? 'border-primary bg-primary-muted text-primary'
                          : 'border-border text-muted hover:text-foreground',
                      )}
                      aria-pressed={active}
                    >
                      {AMENITY_LABELS[item]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // The result list body — count header, states (failed / skeleton / empty /
  // rows), and the "Show more" pager. Rendered twice (desktop floating panel +
  // mobile sheet) with a distinct card-ref map each so the two DOM copies don't
  // collide on slug keys.
  const hasActiveFilters =
    !!filters.query ||
    filters.openNow ||
    filters.deals ||
    filters.pickup ||
    filters.delivery ||
    filters.medical ||
    filters.recreational ||
    filters.amenities.length > 0 ||
    filters.sort !== 'default';

  const listContent = (rowRefs: MutableRefObject<Map<string, HTMLDivElement>>) => (
    <>
      <p className="text-muted mb-2 px-3 text-sm" aria-live="polite">
        {loading ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
          </span>
        ) : widened ? (
          <>
            No matches nearby — showing {total.toLocaleString()}{' '}
            {total === 1 ? noun.one : noun.many} across the US
            {filters.query ? ` for “${filters.query}”` : ''}
          </>
        ) : (
          <>
            {total.toLocaleString()} {total === 1 ? noun.one : noun.many} in this area
            {filters.query ? ` for “${filters.query}”` : ''}
          </>
        )}
      </p>

      {failed ? (
        <div className="card text-muted mx-3 p-10 text-center text-sm">
          Couldn&apos;t load results.{' '}
          <button
            type="button"
            className="text-primary font-medium hover:underline"
            onClick={() => void runSearch(viewBounds.current, filters, {})}
          >
            Try again
          </button>
        </div>
      ) : shops.length === 0 && loading ? (
        // Fresh area with nothing on screen yet — skeleton rows shaped like
        // DispensaryResultRow so the panel doesn't jump on arrival.
        <div className="divide-border border-border divide-y border-y" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex animate-pulse gap-3 px-3 py-3">
              <div className="min-w-0 flex-1 space-y-2 py-1">
                <div className="bg-surface-2 h-4 w-3/4 rounded" />
                <div className="bg-surface-2 h-3 w-1/2 rounded" />
                <div className="bg-surface-2 h-3 w-2/3 rounded" />
              </div>
              <div className="bg-surface-2 h-[84px] w-[84px] shrink-0 rounded-lg" />
            </div>
          ))}
        </div>
      ) : shops.length === 0 && !loading ? (
        <div className="card text-muted mx-3 p-8 text-center text-sm">
          <p>No {noun.many} match here. Try zooming out or moving the map.</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => applyFilters(EMPTY_FILTERS)}
              className="text-primary focus-visible:ring-primary mt-3 rounded-full font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div
          className={cn('divide-border border-border divide-y border-y', loading && 'opacity-60')}
        >
          {shops.map((s, i) => (
            <div
              key={s.id}
              ref={(el) => {
                if (el) rowRefs.current.set(s.slug, el);
                else rowRefs.current.delete(s.slug);
              }}
              onMouseEnter={() => setHovered(s.slug)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                'transition-colors',
                (hovered === s.slug || popupShop?.slug === s.slug) && 'bg-surface-2',
              )}
            >
              <DispensaryResultRow
                d={{
                  slug: s.slug,
                  name: s.name,
                  city: s.city,
                  state: s.state,
                  coverImageUrl: s.coverImageUrl,
                  logoUrl: s.logoUrl,
                  isDelivery: s.isDelivery,
                  isPickup: s.isPickup,
                  isMedical: s.isMedical,
                  isRecreational: s.isRecreational,
                  featured: s.featured,
                  sponsored: s.sponsored,
                  rank: i + 1,
                  placementId: s.placementId,
                  adSlot: s.adSlot,
                  distanceMeters: s.distanceMeters,
                  rating: s.rating,
                  reviewCount: s.reviewCount,
                  licensed: s.licensed,
                  openNow: s.isOpenNow,
                  hours: s.hours,
                  timezone: s.timezone,
                  dealBadge: s.dealBadge,
                }}
                quickActions={
                  <RowQuickActions
                    slug={s.slug}
                    dispensaryId={s.id}
                    lat={s.lat}
                    lng={s.lng}
                    deliveryOnly={s.isDelivery && !s.isPickup}
                    isFavorite={favorites.has(s.id)}
                    onToggleFavorite={toggleFavorite}
                  />
                }
              />
            </div>
          ))}
        </div>
      )}

      {!failed && shops.length < total && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void runSearch(searchedBounds.current, filters, {
                append: true,
                offset: shops.length,
              })
            }
            className="border-border bg-surface hover:border-primary/50 rounded-full border px-5 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Show more ({shops.length.toLocaleString()} of {total.toLocaleString()})
          </button>
        </div>
      )}
    </>
  );

  // Peek-state body of the mobile sheet: the swipeable card carousel whose
  // scroll recenters the map on the centered card (Weedmaps' mobile pattern).
  const mobileCarousel =
    shops.length > 0 ? (
      <div
        ref={stripRef}
        onScroll={handleStripScroll}
        className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 pt-1"
      >
        {shops.slice(0, 30).map((s) => (
          <a
            key={s.id}
            href={`/dispensary/${s.slug}`}
            ref={(el) => {
              if (el) stripCardRefs.current.set(s.slug, el);
              else stripCardRefs.current.delete(s.slug);
            }}
            className={cn(
              'bg-surface border-border shadow-card focus-visible:ring-primary flex w-[17rem] shrink-0 snap-center items-center gap-3 rounded-xl border p-2.5 focus-visible:outline-none focus-visible:ring-2',
              hovered === s.slug && 'border-primary/70',
            )}
          >
            <MediaImage
              url={s.coverImageUrl}
              alt={s.name}
              className="h-16 w-16 shrink-0 rounded-lg"
              iconClassName="h-6 w-6"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{s.name}</p>
              <p className="text-muted truncate text-xs">
                {s.rating > 0 ? `★ ${s.rating.toFixed(1)} · ` : s.licensed ? 'Licensed · ' : ''}
                {s.city || 'Delivery only'}
                {formatDistance(s.distanceMeters) ? ` · ${formatDistance(s.distanceMeters)}` : ''}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                {s.isOpenNow !== null && (
                  <span className={s.isOpenNow ? 'text-primary' : 'text-muted'}>
                    {s.isOpenNow ? 'Open now' : 'Closed'}
                  </span>
                )}
                {s.dealBadge && (
                  <span className="bg-primary-muted text-primary rounded-full px-1.5 py-px font-semibold">
                    {s.dealBadge}
                  </span>
                )}
              </p>
            </div>
          </a>
        ))}
      </div>
    ) : (
      <p className="text-muted px-4 py-4 text-sm">
        {loading ? 'Searching this area…' : `No ${noun.many} here — pan or zoom the map.`}
      </p>
    );

  return (
    <div
      className={cn(
        'flex flex-col',
        variant === 'page'
          ? 'h-[calc(100dvh-4rem)]'
          : 'border-border rounded-card h-[70vh] min-h-[480px] overflow-hidden border',
      )}
    >
      {filtersBar}

      <div className="relative min-h-0 flex-1">
        {/* T9 — visually-hidden, keyboard-navigable mirror of the map pins so
            the canvas map is operable by assistive tech. */}
        <MapResultsMirror shops={shops} onFocusShop={setHovered} onBlur={() => setHovered(null)} />

        {/* Result list — desktop only: a floating panel hovering over the left
            edge of the full-bleed map (Weedmaps pattern) so the map keeps ONE
            scroll/zoom surface. On mobile the list lives in the bottom sheet. */}
        <div
          ref={listRef}
          className={cn(
            'hidden overflow-y-auto py-3',
            'lg:absolute lg:bottom-4 lg:left-4 lg:top-4 lg:z-10 lg:block lg:w-[25.5rem]',
            'lg:rounded-card lg:border-border lg:bg-surface lg:shadow-card-hover lg:border',
          )}
        >
          {listContent(cardRefs)}
        </div>

        {/* Full-bleed map — fills the whole page (mobile is map-first, with the
            list in an overlaid bottom sheet below). */}
        <div className="absolute inset-0">
          {/* Auto mode: the map's own toast owns the in-flight state. Manual
              mode the "Search this area" button shows its own spinner, so we
              suppress the map toast (searching) to avoid two indicators colliding. */}
          <BrowseMap
            pins={rankedPins}
            promoAds={promoAds}
            searching={loading && autoSearch}
            initialBounds={initialBounds}
            hoveredSlug={hovered}
            selected={popupShop}
            apiRef={mapApi}
            onHover={setHovered}
            onSelect={handleSelect}
            onLoadBounds={handleLoadBounds}
            onMoveEnd={handleMoveEnd}
            onGeolocate={handleGeolocate}
          />

          {!autoSearch && areaChanged && (
            <button
              type="button"
              onClick={() => void runSearch(viewBounds.current, filters, {})}
              className="bg-surface border-border text-foreground shadow-card-hover hover:border-primary/60 absolute left-1/2 top-3 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCw className="h-4 w-4" />
              )}
              Search this area
            </button>
          )}

          {/* Google Maps-style auto-search toggle — sits right of the floating
              list panel on desktop, top-left on mobile map view. */}
          <label className="bg-surface/90 border-border text-foreground absolute left-3 top-3 z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur lg:left-[27.5rem]">
            <input
              type="checkbox"
              checked={autoSearch}
              onChange={toggleAutoSearch}
              className="accent-primary h-3.5 w-3.5"
            />
            Search as map moves
          </label>
        </div>

        {/* Mobile map-first bottom sheet: peek (carousel) → half → full (list). */}
        <MapBottomSheet
          snap={sheetSnap}
          onSnapChange={setSheetSnap}
          label={
            loading
              ? 'Searching this area…'
              : `${total.toLocaleString()} ${total === 1 ? noun.one : noun.many} nearby`
          }
          peek={mobileCarousel}
        >
          <div className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {listContent(sheetCardRefs)}
          </div>
        </MapBottomSheet>
      </div>
    </div>
  );
}
