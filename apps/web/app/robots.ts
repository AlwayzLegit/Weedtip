import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

// Mirror sitemap.ts's chunk size so the shard list here matches what
// generateSitemaps() emits.
const CHUNK = 40_000;

export const revalidate = 86400;

/**
 * How many sitemap shards exist right now: id 0 (pages) + id 1 (catalog) +
 * one per 40k dispensaries + one per 40k products. Listing every shard URL
 * explicitly (rather than only /sitemap.xml) guarantees crawlers discover all
 * of them regardless of the index route.
 */
async function sitemapUrls(): Promise<string[]> {
  let dChunks = 1;
  let pChunks = 1;
  try {
    const supabase = await createClient();
    const [{ count: d }, { count: p }] = await Promise.all([
      supabase
        .from('dispensaries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase.from('products').select('id', { count: 'exact', head: true }),
    ]);
    dChunks = Math.max(1, Math.ceil((d ?? 0) / CHUNK));
    pChunks = Math.max(1, Math.ceil((p ?? 0) / CHUNK));
  } catch {
    // Fall back to the minimum shard set on a DB hiccup.
  }
  const total = 2 + dChunks + pChunks;
  return Array.from({ length: total }, (_, i) => `${SITE_URL}/sitemap/${i}.xml`);
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Keep authenticated, transactional, and API surfaces out of the index.
      disallow: [
        '/admin',
        '/dashboard',
        '/studio',
        '/account',
        '/orders',
        '/cart',
        '/api/',
        '/sign-in',
        '/sign-up',
        '/forgot-password',
        '/auth/',
        '/embed/',
      ],
    },
    sitemap: await sitemapUrls(),
    host: SITE_URL,
  };
}
