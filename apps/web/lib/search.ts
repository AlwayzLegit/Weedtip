import type { Database } from '@weedtip/supabase/types';

export type SearchResult = Database['public']['Functions']['search_global']['Returns'][number];

export const SEARCH_KIND_LABEL: Record<string, string> = {
  dispensary: 'Dispensaries',
  product: 'Products',
  brand: 'Brands',
  strain: 'Strains',
};

/** The detail-page link for a search result (products are keyed by id, others by slug). */
export function searchResultHref(r: Pick<SearchResult, 'kind' | 'id' | 'slug'>): string {
  switch (r.kind) {
    case 'dispensary':
      return `/dispensary/${r.slug}`;
    case 'product':
      return `/product/${r.id}`;
    case 'brand':
      return `/brand/${r.slug}`;
    case 'strain':
      return `/strain/${r.slug}`;
    default:
      return '/';
  }
}

/** Stable display order for grouped results. */
export const SEARCH_KIND_ORDER = ['dispensary', 'product', 'brand', 'strain'] as const;
