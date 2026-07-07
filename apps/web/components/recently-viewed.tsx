'use client';

import { useEffect, useState } from 'react';
import { Link } from 'next-view-transitions';
import { Clock } from 'lucide-react';
import { MediaImage } from './media-image';

export type RecentItem = {
  kind: 'dispensary' | 'product' | 'strain';
  href: string;
  name: string;
  image?: string | null;
  sub?: string | null;
};

const KEY = 'wt_recent';
const CAP = 12;

function read(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentItem[]) : [];
    return Array.isArray(list) ? list.filter((i) => i && i.href && i.name) : [];
  } catch {
    return [];
  }
}

/**
 * Records a detail-page view to localStorage (most-recent first, deduped by
 * href, capped). Mounted on dispensary/product/strain pages; renders nothing.
 * Client-only + private, so this never touches the server or the DB.
 */
export function RecordRecentlyViewed({ item }: { item: RecentItem }) {
  useEffect(() => {
    if (!item.href || !item.name) return;
    try {
      const next = [item, ...read().filter((i) => i.href !== item.href)].slice(0, CAP);
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage full or blocked — recently-viewed is best-effort */
    }
  }, [item]);
  return null;
}

/**
 * Horizontal rail of the visitor's recently viewed items. Reads localStorage
 * on mount, so it renders nothing on the server and for first-time visitors —
 * no layout reserved until there's history to show. Optionally hides the item
 * for the page it's currently on (`excludeHref`).
 */
export function RecentlyViewedRail({
  title = 'Recently viewed',
  excludeHref,
  className = '',
}: {
  title?: string;
  excludeHref?: string;
  className?: string;
}) {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    setItems(read().filter((i) => i.href !== excludeHref));
  }, [excludeHref]);

  if (items.length === 0) return null;

  return (
    <section className={className}>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <Clock className="text-primary h-5 w-5" />
        {title}
      </h2>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className="rounded-card border-border bg-surface shadow-card hover:border-primary/50 hover:shadow-card-hover group w-40 shrink-0 snap-start overflow-hidden border transition-all duration-200 hover:-translate-y-0.5"
          >
            <MediaImage
              url={i.image ?? null}
              alt={i.name}
              artSeed={i.name}
              className="h-24"
              iconClassName="h-8 w-8"
            />
            <div className="p-2.5">
              <p className="group-hover:text-primary truncate text-sm font-semibold transition-colors">
                {i.name}
              </p>
              {i.sub && <p className="text-muted truncate text-xs">{i.sub}</p>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
