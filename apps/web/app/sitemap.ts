import type { MetadataRoute } from 'next';
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
    { path: '/products', priority: 0.8, freq: 'daily' as const },
    { path: '/strains', priority: 0.6, freq: 'weekly' as const },
    { path: '/brands', priority: 0.6, freq: 'weekly' as const },
    { path: '/deals', priority: 0.7, freq: 'daily' as const },
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
    const [dispensaries, products, strains, brands] = await Promise.all([
      supabase.from('dispensaries').select('slug, updated_at'),
      supabase.from('products').select('id, updated_at'),
      supabase.from('strains').select('slug, updated_at'),
      supabase.from('brands').select('slug, updated_at'),
    ]);

    const dynamicRoutes: MetadataRoute.Sitemap = [
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
    ];

    return [...staticRoutes, ...dynamicRoutes];
  } catch {
    // Never let a transient DB hiccup break the sitemap; serve the static routes.
    return staticRoutes;
  }
}
