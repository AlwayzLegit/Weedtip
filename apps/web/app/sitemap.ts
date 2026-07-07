import type { MetadataRoute } from 'next';
import { PRODUCT_CATEGORIES } from '@weedtip/shared';
import { ARTICLES } from '@/lib/learn';
import { citySlug } from '@/lib/seo';
import { SITE_URL } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

// Regenerate at most once a day — the sitemap pages through tens of thousands of
// rows, so we don't want to rebuild it on every crawler hit.
export const revalidate = 86400;

/**
 * Fetch every row of a query, paging past PostgREST's default row cap (1k) so
 * large tables (products, dispensaries) aren't silently truncated.
 */
async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await query(from, from + PAGE - 1);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

/**
 * Dynamic sitemap. Static marketing/browse routes plus every public dispensary,
 * product, strain, and brand. Runs as the anon role, so RLS already restricts it
 * to publicly visible rows (active dispensaries and their products).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { path: '', priority: 1, freq: 'daily' as const },
    { path: '/dispensaries', priority: 0.9, freq: 'daily' as const },
    { path: '/deliveries', priority: 0.8, freq: 'daily' as const },
    { path: '/products', priority: 0.8, freq: 'daily' as const },
    { path: '/strains', priority: 0.6, freq: 'weekly' as const },
    { path: '/brands', priority: 0.6, freq: 'weekly' as const },
    { path: '/deals', priority: 0.7, freq: 'daily' as const },
    { path: '/learn', priority: 0.6, freq: 'weekly' as const },
    { path: '/claim', priority: 0.4, freq: 'monthly' as const },
    { path: '/terms', priority: 0.2, freq: 'yearly' as const },
    { path: '/privacy', priority: 0.2, freq: 'yearly' as const },
    { path: '/disclaimer', priority: 0.2, freq: 'yearly' as const },
  ].map(({ path, priority, freq }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: freq,
    priority,
  }));

  try {
    const supabase = await createClient();
    const [dispensaryRows, productRows, strains, brands, categories] = await Promise.all([
      fetchAll<{ slug: string; city: string | null; state: string; updated_at: string }>((f, t) =>
        supabase.from('dispensaries').select('slug, city, state, updated_at').range(f, t),
      ),
      fetchAll<{
        id: string;
        updated_at: string;
        category: { slug: string } | null;
        dispensary: { city: string | null; state: string } | null;
      }>((f, t) =>
        supabase
          .from('products')
          .select(
            'id, updated_at, category:categories(slug), dispensary:dispensaries(city, state)',
          )
          .range(f, t),
      ),
      supabase.from('strains').select('slug, updated_at'),
      supabase.from('brands').select('slug, updated_at'),
      supabase.from('categories').select('slug'),
    ]);

    // Which city × category pages actually list products — the long-tail pages
    // render an empty grid otherwise, and advertising thousands of empty pages
    // to crawlers reads as doorway spam on a young domain.
    const stockedCityCategories = new Set<string>();
    for (const p of productRows) {
      const cat = p.category?.slug;
      const d = p.dispensary;
      if (!cat || !d?.city) continue;
      stockedCityCategories.add(`${d.state.toLowerCase()}/${citySlug(d.city)}/${cat}`);
    }

    // Which locations actually have live deals — so we don't advertise thousands
    // of empty /deals pages (their JSON-LD would self-report "0 deals").
    const nowIso = now.toISOString();
    const { data: dealRows } = await supabase
      .from('deals')
      .select('dispensary:dispensaries!inner(state, city, status)')
      .eq('is_active', true)
      .lte('start_date', nowIso)
      .gte('end_date', nowIso)
      .eq('dispensary.status', 'active');
    const dealStateSet = new Set<string>();
    const dealCitySet = new Set<string>();
    for (const row of dealRows ?? []) {
      const d = row.dispensary as { state: string; city: string | null } | null;
      if (!d) continue;
      const st = d.state.toLowerCase();
      dealStateSet.add(st);
      if (d.city) dealCitySet.add(`${st}/${citySlug(d.city)}`);
    }

    // Local SEO landing pages: distinct states and state+city combinations.
    const stateSet = new Set<string>();
    const citySet = new Set<string>();
    for (const d of dispensaryRows) {
      const st = d.state.toLowerCase();
      stateSet.add(st);
      if (d.city) citySet.add(`${st}/${citySlug(d.city)}`);
    }
    const locationRoutes: MetadataRoute.Sitemap = [
      ...[...stateSet].map((st) => ({
        url: `${SITE_URL}/dispensaries/${st}`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
      ...[...citySet].map((loc) => ({
        url: `${SITE_URL}/dispensaries/${loc}`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
      // Deals by location — only where live deals exist (else they're empty
      // doorway pages that advertise "0 deals" in their structured data).
      ...[...stateSet]
        .filter((st) => dealStateSet.has(st))
        .map((st) => ({
          url: `${SITE_URL}/deals/${st}`,
          lastModified: now,
          changeFrequency: 'daily' as const,
          priority: 0.6,
        })),
      ...[...citySet]
        .filter((loc) => dealCitySet.has(loc))
        .map((loc) => ({
          url: `${SITE_URL}/deals/${loc}`,
          lastModified: now,
          changeFrequency: 'daily' as const,
          priority: 0.6,
        })),
      // Category × city long-tail (e.g. /dispensaries/co/denver/flower) — only
      // where that category actually has products listed in that city.
      ...[...citySet].flatMap((loc) =>
        PRODUCT_CATEGORIES.filter((c) => stockedCityCategories.has(`${loc}/${c.slug}`)).map(
          (c) => ({
            url: `${SITE_URL}/dispensaries/${loc}/${c.slug}`,
            lastModified: now,
            changeFrequency: 'weekly' as const,
            priority: 0.6,
          }),
        ),
      ),
    ];

    const dynamicRoutes: MetadataRoute.Sitemap = [
      ...locationRoutes,
      ...dispensaryRows.map((d) => ({
        url: `${SITE_URL}/dispensary/${d.slug}`,
        lastModified: new Date(d.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
      ...productRows.map((p) => ({
        url: `${SITE_URL}/product/${p.id}`,
        lastModified: new Date(p.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
      ...(strains.data ?? []).map((s) => ({
        url: `${SITE_URL}/strain/${s.slug}`,
        lastModified: new Date(s.updated_at),
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      })),
      ...(brands.data ?? []).map((b) => ({
        url: `${SITE_URL}/brand/${b.slug}`,
        lastModified: new Date(b.updated_at),
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      })),
      ...(categories.data ?? []).map((c) => ({
        url: `${SITE_URL}/products/${c.slug}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
      ...ARTICLES.map((a) => ({
        url: `${SITE_URL}/learn/${a.slug}`,
        lastModified: new Date(a.dateModified),
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      })),
    ];

    return [...staticRoutes, ...dynamicRoutes];
  } catch {
    // Never let a transient DB hiccup break the sitemap; serve the static routes.
    return staticRoutes;
  }
}
