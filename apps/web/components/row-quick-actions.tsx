'use client';

import { Heart, Navigation } from 'lucide-react';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

/**
 * Compact row-level actions for map result rows (Weedmaps pattern): Save
 * (heart) and Directions. Rendered inside DispensaryResultRow's `quickActions`
 * slot, above the stretched row link. The parent owns favorite state (loaded
 * once for the whole list) and the toggle handler; signed-out users are routed
 * to sign-in by the handler.
 */
export function RowQuickActions({
  slug,
  dispensaryId,
  lat,
  lng,
  deliveryOnly,
  isFavorite,
  onToggleFavorite,
}: {
  slug: string;
  dispensaryId: string;
  lat: number | null;
  lng: number | null;
  /** Service-area pin — no storefront to navigate to. */
  deliveryOnly?: boolean;
  isFavorite: boolean;
  onToggleFavorite: (dispensaryId: string, slug: string) => void;
}) {
  const pill =
    'border-border bg-surface text-muted hover:text-foreground hover:border-primary/50 inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition-colors';
  return (
    <>
      <button
        type="button"
        aria-label={isFavorite ? 'Remove from saved' : 'Save'}
        aria-pressed={isFavorite}
        onClick={() => onToggleFavorite(dispensaryId, slug)}
        className={cn(pill, isFavorite && 'border-primary/50 text-primary')}
      >
        <Heart className={cn('h-3 w-3', isFavorite && 'fill-current')} />
        {isFavorite ? 'Saved' : 'Save'}
      </button>
      {lat != null && lng != null && !deliveryOnly && (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('directions_clicked', { slug, surface: 'map_list' })}
          className={pill}
        >
          <Navigation className="h-3 w-3" /> Directions
        </a>
      )}
    </>
  );
}
