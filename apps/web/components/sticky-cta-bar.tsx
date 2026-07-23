import { MapPin } from 'lucide-react';

/**
 * Lightweight sticky mobile CTA bar (Weedmaps pattern) for pages whose primary
 * action is "find where to buy" — brand and product pages. Mobile only; keeps
 * one clear action pinned without scrolling. Server component (a single link).
 */
export function StickyCtaBar({ href, label }: { href: string; label: string }) {
  return (
    <div
      className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t px-3 py-2 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
    >
      <a
        href={href}
        className="bg-primary bg-primary-grad text-primary-foreground shadow-glow-sm mx-auto flex h-11 max-w-2xl items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold"
      >
        <MapPin className="h-4 w-4" /> {label}
      </a>
    </div>
  );
}
