'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { METERS_PER_MILE } from '@weedtip/shared';
import { cn } from '@/lib/utils';

const TOGGLES = [
  { param: 'open_now', label: 'Open now' },
  { param: 'is_pickup', label: 'Pickup' },
  { param: 'is_delivery', label: 'Delivery' },
  { param: 'is_medical', label: 'Medical' },
  { param: 'is_recreational', label: 'Recreational' },
] as const;

const RADIUS_OPTIONS = [10, 25, 50, 100]; // miles

export function DispensaryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasGeo = searchParams.has('lat') && searchParams.has('lng');

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null) params.delete(key);
      else params.set(key, value);
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {TOGGLES.map(({ param, label }) => {
        const active = searchParams.get(param) === 'true';
        return (
          <button
            key={param}
            onClick={() => setParam(param, active ? null : 'true')}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'border-primary bg-primary-muted text-primary'
                : 'border-border text-muted hover:text-foreground',
            )}
            aria-pressed={active}
          >
            {label}
          </button>
        );
      })}

      {hasGeo && (
        <select
          value={searchParams.get('radius_meters') ?? String(Math.round(25 * METERS_PER_MILE))}
          onChange={(e) => setParam('radius_meters', e.target.value)}
          className="border-border bg-surface h-9 rounded-full border px-3 text-sm"
          aria-label="Search radius"
        >
          {RADIUS_OPTIONS.map((mi) => (
            <option key={mi} value={Math.round(mi * METERS_PER_MILE)}>
              Within {mi} mi
            </option>
          ))}
        </select>
      )}

      <select
        value={searchParams.get('sort') ?? ''}
        onChange={(e) => setParam('sort', e.target.value || null)}
        className="border-border bg-surface h-9 rounded-full border px-3 text-sm"
        aria-label="Sort by"
      >
        <option value="">Sort: Relevance</option>
        <option value="rating">Top rated</option>
        {hasGeo && <option value="distance">Nearest</option>}
        <option value="name">Name (A–Z)</option>
      </select>
    </div>
  );
}
