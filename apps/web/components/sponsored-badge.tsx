import { cn } from '@/lib/utils';

/**
 * The one paid-placement chip used everywhere sponsored inventory renders
 * (featured brand/product rails, hero). Deliberately distinct from the
 * primary-toned sale/strain badges — a dark, high-contrast "Ad" chip (the
 * Weedmaps convention) so a shopper can tell paid from organic at a glance,
 * and it reads legibly sitting over card artwork.
 */
export function SponsoredBadge({
  label = 'Sponsored',
  className,
}: {
  label?: 'Sponsored' | 'Featured';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ring-1 ring-white/25 backdrop-blur-sm',
        className,
      )}
    >
      {label}
    </span>
  );
}
