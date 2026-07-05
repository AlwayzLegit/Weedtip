'use client';

import { useMemo, useState } from 'react';
import { Search, Tag } from 'lucide-react';
import type { StrainType } from '@weedtip/shared';
import { AddToCart } from '@/components/cart/add-to-cart';
import { ProductCard } from '@/components/product-card';
import { cn } from '@/lib/utils';

export interface MenuBrowserItem {
  id: string;
  name: string;
  brand: string | null;
  priceCents: number;
  /** Original list price when an auto-apply sale is active. */
  originalPriceCents: number | null;
  imageUrl: string | null;
  strainType: StrainType | null;
  thcPercentage: number | null;
  inStock: boolean;
  categorySlug: string;
  categoryName: string;
  categorySort: number;
}

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'thc';

/**
 * Interactive storefront menu: search within the menu, category tabs (plus a
 * Sale tab when live discounts apply), and shopper-relevant sorts — all
 * client-side over the shop's full menu, which the page already loads.
 */
export function MenuBrowser({
  dispensary,
  items,
}: {
  dispensary: { id: string; slug: string; name: string };
  items: MenuBrowserItem[];
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | 'sale' | string>('all');
  const [sort, setSort] = useState<SortKey>('featured');

  const categories = useMemo(() => {
    const m = new Map<string, { name: string; sort: number; count: number }>();
    for (const it of items) {
      const cur = m.get(it.categorySlug);
      if (cur) cur.count += 1;
      else m.set(it.categorySlug, { name: it.categoryName, sort: it.categorySort, count: 1 });
    }
    return [...m.entries()].sort((a, b) => a[1].sort - b[1].sort);
  }, [items]);

  const saleCount = useMemo(
    () => items.filter((i) => i.originalPriceCents != null).length,
    [items],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items;
    if (category === 'sale') list = list.filter((i) => i.originalPriceCents != null);
    else if (category !== 'all') list = list.filter((i) => i.categorySlug === category);
    if (q) {
      list = list.filter(
        (i) => i.name.toLowerCase().includes(q) || (i.brand ?? '').toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    switch (sort) {
      case 'price-asc':
        sorted.sort((a, b) => a.priceCents - b.priceCents);
        break;
      case 'price-desc':
        sorted.sort((a, b) => b.priceCents - a.priceCents);
        break;
      case 'thc':
        sorted.sort((a, b) => (b.thcPercentage ?? -1) - (a.thcPercentage ?? -1));
        break;
      default:
        // Featured: in-stock first, sale items first within that, then category order.
        sorted.sort(
          (a, b) =>
            Number(b.inStock) - Number(a.inStock) ||
            Number(b.originalPriceCents != null) - Number(a.originalPriceCents != null) ||
            a.categorySort - b.categorySort ||
            a.name.localeCompare(b.name),
        );
    }
    return sorted;
  }, [items, query, category, sort]);

  const tabClass = (active: boolean) =>
    cn(
      'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
      active
        ? 'border-primary bg-primary-muted text-primary'
        : 'border-border text-muted hover:text-foreground',
    );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${dispensary.name}'s menu…`}
            aria-label="Search this menu"
            className="border-border bg-surface focus:border-primary h-9 w-full rounded-full border pl-9 pr-3 text-sm outline-none transition-colors"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort menu"
          className="border-border bg-surface h-9 rounded-full border px-3 text-sm"
        >
          <option value="featured">Sort: Featured</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="thc">THC %</option>
        </select>
      </div>

      <div className="scrollbar-none -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 py-0.5">
        <button type="button" onClick={() => setCategory('all')} className={tabClass(category === 'all')}>
          All ({items.length})
        </button>
        {saleCount > 0 && (
          <button
            type="button"
            onClick={() => setCategory('sale')}
            className={tabClass(category === 'sale')}
          >
            <Tag className="mr-1 inline h-3.5 w-3.5" />
            Sale ({saleCount})
          </button>
        )}
        {categories.map(([slug, c]) => (
          <button
            key={slug}
            type="button"
            onClick={() => setCategory(slug)}
            className={tabClass(category === slug)}
          >
            {c.name} ({c.count})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="card text-muted mt-4 p-8 text-center text-sm">
          Nothing matches{query ? ` “${query.trim()}”` : ''} here. Try another category or clear
          the search.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {visible.map((p) => (
            <div key={p.id} className="space-y-2">
              <ProductCard
                p={{
                  name: p.name,
                  brand: p.brand,
                  priceCents: p.priceCents,
                  originalPriceCents: p.originalPriceCents,
                  imageUrl: p.imageUrl,
                  strainType: p.strainType,
                  thcPercentage: p.thcPercentage,
                  inStock: p.inStock,
                  productId: p.id,
                }}
              />
              {p.inStock && (
                <AddToCart
                  dispensary={{ id: dispensary.id, slug: dispensary.slug, name: dispensary.name }}
                  product={{ productId: p.id, name: p.name, priceCents: p.priceCents }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
