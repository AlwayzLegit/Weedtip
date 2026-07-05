'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { List, Loader2, Map as MapIcon, RotateCw, Search, SlidersHorizontal } from 'lucide-react';
import {
  AMENITY_GROUPS,
  AMENITY_LABELS,
  type Amenity,
  type DispensarySort,
} from '@weedtip/shared';
import { searchDispensariesBounds } from '@weedtip/supabase/queries';
import { isOpenNow } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { BBox } from '@/lib/us-state-bounds';
import { BrowseMap, type BrowserShop } from './browse-map';
import { DispensaryCard } from './dispensary-card';

export type { BrowserShop };

export type BrowseFilters = {
  openNow: boolean;
  pickup: boolean;
  delivery: boolean;
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
  medical: false,
  recreational: false,
  amenities: [],
  sort: 'default',
  query: '',
};

const PILLS = [
  { key: 'openNow', label: 'Open now' },
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
  distance_meters: number;
  is_open_now: boolean;
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
    rating: r.rating_avg,
    reviewCount: r.rating_count,
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
 * other on hover. Mobile collapses to a List/Map toggle.
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
}: {
  initialShops: BrowserShop[];
  initialTotal: number;
  initialBounds: BBox;
  initialFilters?: BrowseFilters;
  initialOrigin?: { lat: number; lng: number } | null;
  heading?: string;
  variant?: 'page' | 'embedded';
  syncUrl?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [filters, setFilters] = useState<BrowseFilters>(initialFilters);
  const [queryDraft, setQueryDraft] = useState(initialFilters.query);
  const [shops, setShops] = useState<BrowserShop[]>(initialShops);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [origin, setOrigin] = useState(initialOrigin);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const [showMore, setShowMore] = useState(false);
  const [areaChanged, setAreaChanged] = useState(false);

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
  const requestId = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  const runSearch = useCallback(
    async (
      bounds: BBox,
      nextFilters: BrowseFilters,
      opts: { append?: boolean; offset?: number; origin?: { lat: number; lng: number } | null },
    ) => {
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
      setTotal(data?.[0]?.total_count ?? (opts.append ? total : 0));
      setShops((prev) => (opts.append ? [...prev, ...rows] : rows));
      if (!opts.append) {
        setSelectedSlug(null);
        listRef.current?.scrollTo({ top: 0 });
      }
      searchedBounds.current = bounds;
      setAreaChanged(false);
    },
    [supabase, origin, total],
  );

  // Reflect filters into the URL (share/refresh keeps state) without a server nav.
  const syncFiltersToUrl = useCallback(
    (f: BrowseFilters) => {
      if (!syncUrl || typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const setBool = (key: string, on: boolean) =>
        on ? params.set(key, 'true') : params.delete(key);
      setBool('open_now', f.openNow);
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

  const applyFilters = useCallback(
    (patch: Partial<BrowseFilters>) => {
      const next = { ...filters, ...patch };
      setFilters(next);
      syncFiltersToUrl(next);
      void runSearch(viewBounds.current, next, {});
    },
    [filters, runSearch, syncFiltersToUrl],
  );

  // The map fits initialBounds to its own aspect ratio, so the viewport it
  // actually shows is wider than what we searched — treat that as the baseline.
  const handleLoadBounds = useCallback((bounds: BBox) => {
    viewBounds.current = bounds;
    searchedBounds.current = bounds;
  }, []);

  const handleMoveEnd = useCallback(
    (bounds: BBox) => {
      viewBounds.current = bounds;
      if (autoSearchNextMove.current) {
        autoSearchNextMove.current = false;
        void runSearch(bounds, filters, {});
        return;
      }
      setAreaChanged(boundsChanged(searchedBounds.current, bounds));
    },
    [filters, runSearch],
  );

  const handleGeolocate = useCallback((coords: { lat: number; lng: number }) => {
    setOrigin(coords);
    // The locate control flies the map; re-search where it lands.
    autoSearchNextMove.current = true;
  }, []);

  // Map pin click → open popup and bring the matching card into view.
  const handleSelect = useCallback((slug: string | null) => {
    setSelectedSlug(slug);
    if (slug) {
      cardRefs.current.get(slug)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, []);

  const selected = useMemo(
    () => shops.find((s) => s.slug === selectedSlug) ?? null,
    [shops, selectedSlug],
  );

  const pillClass = (active: boolean) =>
    cn(
      'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
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
        <form
          role="search"
          className="relative w-full sm:w-auto sm:min-w-0 sm:max-w-xs sm:flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters({ query: queryDraft.trim() });
          }}
        >
          <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            value={queryDraft}
            onChange={(e) => setQueryDraft(e.target.value)}
            placeholder="Search this map…"
            aria-label="Search dispensaries"
            className="border-border bg-surface focus:border-primary h-9 w-full rounded-full border pl-9 pr-3 text-sm outline-none transition-colors"
          />
        </form>
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
            onChange={(e) => applyFilters({ sort: e.target.value as DispensarySort })}
            className="border-border bg-surface h-9 shrink-0 rounded-full border px-3 text-sm"
            aria-label="Sort by"
          >
            <option value="default">Sort: Recommended</option>
            <option value="rating">Top rated</option>
            {origin && <option value="distance">Nearest</option>}
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

      <div className="relative flex min-h-0 flex-1">
        {/* Result list */}
        <div
          ref={listRef}
          className={cn(
            'min-h-0 w-full overflow-y-auto px-4 py-4 lg:block lg:w-[42%] xl:w-[38%]',
            mobileView === 'map' && 'hidden',
          )}
        >
          <p className="text-muted mb-3 text-sm" aria-live="polite">
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
              </span>
            ) : (
              <>
                {total.toLocaleString()} {total === 1 ? 'dispensary' : 'dispensaries'} in this area
                {filters.query ? ` for “${filters.query}”` : ''}
              </>
            )}
          </p>

          {failed ? (
            <div className="card text-muted p-10 text-center text-sm">
              Couldn&apos;t load results.{' '}
              <button
                type="button"
                className="text-primary font-medium hover:underline"
                onClick={() => void runSearch(viewBounds.current, filters, {})}
              >
                Try again
              </button>
            </div>
          ) : shops.length === 0 && !loading ? (
            <div className="card text-muted p-10 text-center text-sm">
              No dispensaries match here. Zoom out, move the map, or clear filters.
            </div>
          ) : (
            <div
              className={cn(
                'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2',
                loading && 'opacity-60',
              )}
            >
              {shops.map((s) => (
                <div
                  key={s.id}
                  ref={(el) => {
                    if (el) cardRefs.current.set(s.slug, el);
                    else cardRefs.current.delete(s.slug);
                  }}
                  onMouseEnter={() => setHovered(s.slug)}
                  onMouseLeave={() => setHovered(null)}
                  className={cn(
                    'rounded-card transition-shadow',
                    (hovered === s.slug || selectedSlug === s.slug) &&
                      'ring-primary/60 ring-2 ring-offset-0',
                  )}
                >
                  <DispensaryCard
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
                      placementId: s.placementId,
                      distanceMeters: s.distanceMeters,
                      rating: s.rating,
                      reviewCount: s.reviewCount,
                      openNow: s.isOpenNow,
                    }}
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
        </div>

        {/* Sticky full-height map */}
        <div
          className={cn(
            'relative min-h-0 flex-1',
            mobileView === 'list' && 'hidden lg:block',
          )}
        >
          <BrowseMap
            shops={shops}
            initialBounds={initialBounds}
            hoveredSlug={hovered}
            selected={selected}
            onHover={setHovered}
            onSelect={handleSelect}
            onLoadBounds={handleLoadBounds}
            onMoveEnd={handleMoveEnd}
            onGeolocate={handleGeolocate}
          />

          {areaChanged && (
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
        </div>

        {/* Mobile list/map toggle */}
        <div className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileView((v) => (v === 'list' ? 'map' : 'list'))}
            className="bg-foreground text-background shadow-card-hover inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
          >
            {mobileView === 'list' ? (
              <>
                <MapIcon className="h-4 w-4" /> Map
              </>
            ) : (
              <>
                <List className="h-4 w-4" /> List
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
