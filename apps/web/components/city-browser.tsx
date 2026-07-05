'use client';

import { useMemo, useState } from 'react';
import { List, Map as MapIcon } from 'lucide-react';
import type { OperatingHours } from '@weedtip/shared';
import { DispensaryCard } from './dispensary-card';
import { ExploreMap, type ExplorePoint } from './explore-map';
import { cn } from '@/lib/utils';

export type CityShop = {
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
  hours: OperatingHours | null;
  timezone: string | null;
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open now' },
  { key: 'pickup', label: 'Pickup' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'medical', label: 'Medical' },
  { key: 'recreational', label: 'Recreational' },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** Open-now in the shop's own timezone, computed client-side so it's live. */
function isOpenNow(hours: OperatingHours | null, timezone: string | null): boolean {
  if (!hours) return false;
  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: timezone || 'America/New_York' }),
  );
  const today = hours[DAY_KEYS[now.getDay()]!];
  if (!today?.open || !today.close) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  const toMins = (t: string) => {
    const [h = '0', m = '0'] = t.split(':');
    return Number(h) * 60 + Number(m);
  };
  const open = toMins(today.open);
  const close = toMins(today.close);
  // Overnight windows (e.g. 20:00–02:00) wrap past midnight.
  return close > open ? mins >= open && mins < close : mins >= open || mins < close;
}

/**
 * Weedmaps-style split browser for a city: filterable dispensary list beside a
 * live pin map of the same result set. Filtering is client-side over the
 * city's shops, so the page itself stays statically cached (ISR).
 */
export function CityBrowser({ shops, cityName }: { shops: CityShop[]; cityName: string }) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');

  const openNowById = useMemo(
    () => new Map(shops.map((s) => [s.id, isOpenNow(s.hours, s.timezone)])),
    [shops],
  );

  const visible = useMemo(() => {
    switch (filter) {
      case 'open':
        return shops.filter((s) => openNowById.get(s.id));
      case 'pickup':
        return shops.filter((s) => s.isPickup);
      case 'delivery':
        return shops.filter((s) => s.isDelivery);
      case 'medical':
        return shops.filter((s) => s.isMedical);
      case 'recreational':
        return shops.filter((s) => s.isRecreational);
      default:
        return shops;
    }
  }, [shops, filter, openNowById]);

  const points: ExplorePoint[] = useMemo(
    () =>
      visible
        .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
        .map((s) => ({
          slug: s.slug,
          name: s.name,
          lat: s.lat as number,
          lng: s.lng as number,
          city: s.city,
          rating: s.rating,
          reviews: s.reviewCount,
          featured: s.featured,
        })),
    [visible],
  );

  const center = useMemo(() => {
    if (points.length === 0) return undefined;
    return {
      lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
      lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length,
    };
  }, [points]);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                filter === f.key
                  ? 'border-primary bg-primary-muted text-primary'
                  : 'border-border text-muted hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Mobile list/map toggle — desktop always shows both. */}
        <div className="border-border flex rounded-lg border p-0.5 lg:hidden">
          {(
            [
              ['list', 'List', List],
              ['map', 'Map', MapIcon],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMobileView(key)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
                mobileView === key ? 'bg-primary-muted text-primary' : 'text-muted',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-muted mt-3 text-sm">
        {visible.length} {visible.length === 1 ? 'dispensary' : 'dispensaries'}
        {filter !== 'all' ? ` · ${FILTERS.find((f) => f.key === filter)?.label}` : ''} in{' '}
        {cityName}
      </p>

      <div className="mt-4 gap-6 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* List column */}
        <div
          className={cn(
            'space-y-4 lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1',
            mobileView === 'map' && 'hidden',
          )}
        >
          {visible.length === 0 ? (
            <div className="card text-muted p-10 text-center">
              No dispensaries match that filter in {cityName}.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {visible.map((s) => (
                <div key={s.id} className="relative">
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
                      rating: s.rating,
                      reviewCount: s.reviewCount,
                    }}
                  />
                  {openNowById.get(s.id) && (
                    <span className="bg-surface text-primary border-primary/40 absolute right-3 top-3 rounded-full border px-2 py-0.5 text-xs font-semibold">
                      Open now
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map column */}
        <div
          className={cn(
            'rounded-card border-border h-[60vh] overflow-hidden border lg:sticky lg:top-20 lg:block lg:h-[calc(100vh-6rem)]',
            mobileView === 'list' && 'hidden lg:block',
          )}
        >
          <ExploreMap points={points} center={center} zoom={12} />
        </div>
      </div>
    </div>
  );
}
