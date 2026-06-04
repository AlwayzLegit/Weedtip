'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { AMENITY_GROUPS, AMENITY_LABELS, METERS_PER_MILE } from '@weedtip/shared';
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

  const selected = new Set((searchParams.get('amenities') ?? '').split(',').filter(Boolean));
  const toggleAmenity = useCallback(
    (key: string) => {
      const next = new Set(selected);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setParam('amenities', next.size ? [...next].join(',') : null);
    },
    [selected, setParam],
  );

  return (
    <div className="space-y-3">
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

      <details className="group">
        <summary className="text-muted hover:text-foreground inline-flex cursor-pointer items-center gap-1 text-sm font-medium">
          More filters{selected.size > 0 ? ` (${selected.size})` : ''}
        </summary>
        <div className="mt-3 space-y-4">
          {selected.size > 0 && (
            <button
              onClick={() => setParam('amenities', null)}
              className="text-primary text-xs hover:underline"
            >
              Clear all
            </button>
          )}
          {AMENITY_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-muted mb-2 text-xs font-semibold uppercase tracking-wide">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.items.map((item) => {
                  const active = selected.has(item);
                  return (
                    <button
                      key={item}
                      onClick={() => toggleAmenity(item)}
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
      </details>
    </div>
  );
}
