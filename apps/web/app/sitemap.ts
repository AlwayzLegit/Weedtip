import type { MetadataRoute } from 'next';
import { PRODUCT_CATEGORIES } from '@weedtip/shared';
import { ARTICLES } from '@/lib/learn';
import { citySlug } from '@/lib/seo';
import { SITE_URL } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

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
    const [dispensaries, products, strains, brands, categories] = await Promise.all([
      supabase.from('dispensaries').select('slug, city, state, updated_at'),
      supabase.from('products').select('id, updated_at'),
      supabase.from('strains').select('slug, updated_at'),
      supabase.from('brands').select('slug, updated_at'),
      supabase.from('categories').select('slug'),
    ]);

    // Local SEO landing pages: distinct states and state+city combinations.
    const stateSet = new Set<string>();
    const citySet = new Set<string>();
    for (const d of dispensaries.data ?? []) {
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
      // Deals by location.
      ...[...stateSet].map((st) => ({
        url: `${SITE_URL}/deals/${st}`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.6,
      })),
      ...[...citySet].map((loc) => ({
        url: `${SITE_URL}/deals/${loc}`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.6,
      })),
      // Category × city long-tail (e.g. /dispensaries/co/denver/flower).
      ...[...citySet].flatMap((loc) =>
        PRODUCT_CATEGORIES.map((c) => ({
          url: `${SITE_URL}/dispensaries/${loc}/${c.slug}`,
          lastModified: now,
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        })),
      ),
    ];

    const dynamicRoutes: MetadataRoute.Sitemap = [
      ...locationRoutes,
      ...(dispensaries.data ?? []).map((d) => ({
        url: `${SITE_URL}/dispensary/${d.slug}`,
        lastModified: new Date(d.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
      ...(products.data ?? []).map((p) => ({
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
