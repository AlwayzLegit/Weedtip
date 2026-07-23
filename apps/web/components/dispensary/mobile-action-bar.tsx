import { Navigation, Phone, Store } from 'lucide-react';

/**
 * Sticky mobile action bar (Weedmaps pattern): keeps the primary action —
 * Order/View menu, or Directions when there's no menu — plus Call and
 * Directions one tap away without scrolling back to the header. Mobile only
 * (the desktop header action row already does this job). Server component:
 * all links, no client state.
 */
export function DispensaryMobileActionBar({
  primaryHref,
  primaryLabel,
  primaryExternal,
  phone,
  directionsUrl,
}: {
  primaryHref: string;
  primaryLabel: string;
  primaryExternal: boolean;
  phone: string | null;
  /** Shown as a secondary icon button only when it isn't already the primary. */
  directionsUrl: string | null;
}) {
  const iconBtn =
    'border-border bg-surface text-foreground inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border';
  return (
    <div
      className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t px-3 py-2 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex max-w-2xl items-center gap-2">
        {directionsUrl && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Get directions"
            className={iconBtn}
          >
            <Navigation className="h-5 w-5" />
          </a>
        )}
        {phone && (
          <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} aria-label="Call" className={iconBtn}>
            <Phone className="h-5 w-5" />
          </a>
        )}
        <a
          href={primaryHref}
          {...(primaryExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="bg-primary bg-primary-grad text-primary-foreground shadow-glow-sm inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold"
        >
          {primaryLabel === 'Get directions' ? (
            <Navigation className="h-4 w-4" />
          ) : (
            <Store className="h-4 w-4" />
          )}
          {primaryLabel}
        </a>
      </div>
    </div>
  );
}
