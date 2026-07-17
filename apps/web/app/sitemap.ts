import type { MetadataRoute } from 'next';
import { PRODUCT_CATEGORIES } from '@weedtip/shared';
import { ARTICLES } from '@/lib/learn';
import { citySlug } from '@/lib/seo';
import { SITE_URL } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

// Regenerate at most once a day — the sitemap pages through tens of thousands of
// rows, so we don't want to rebuild it on every crawler hit.
export const revalidate = 86400;

// Google rejects a sitemap over 50,000 URLs or 50 MB. We shard well under that
// so per-shard growth (products as menus fill in, the city×category long-tail)
// never trips the cap. Next serves the index at /sitemap.xml and each shard at
// /sitemap/{id}.xml.
const CHUNK = 40_000;

type Row = { slug: string; updated_at: string };

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

/** How many chunks each large entity needs — recomputed per shard (cheap count). */
async function shardPlan(): Promise<{ dChunks: number; pChunks: number }> {
  try {
    const supabase = await createClient();
    const [{ count: d }, { count: p }] = await Promise.all([
      supabase
        .from('dispensaries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase.from('products').select('id', { count: 'exact', head: true }),
    ]);
    return {
      dChunks: Math.max(1, Math.ceil((d ?? 0) / CHUNK)),
      pChunks: Math.max(1, Math.ceil((p ?? 0) / CHUNK)),
    };
  } catch {
    return { dChunks: 1, pChunks: 1 };
  }
}

// ─── Shard index ──────────────────────────────────────────────────────────────
// id 0        → pages   (static marketing + local-SEO location routes)
// id 1        → catalog (strains, brands, product categories, articles)
// id 2..N     → dispensary chunks
// id N+1..M   → product chunks
export async function generateSitemaps(): Promise<{ id: number }[]> {
  const { dChunks, pChunks } = await shardPlan();
  const total = 2 + dChunks + pChunks;
  return Array.from({ length: total }, (_, id) => ({ id }));
}

export default async function sitemap({
  id,
}: {
  id: number | string;
}): Promise<MetadataRoute.Sitemap> {
  // Next passes the shard id from the URL as a string ("0", "1", …) — coerce
  // so the numeric branch checks below match.
  const n = Number(id);
  if (n === 0) return pagesSitemap();
  if (n === 1) return catalogSitemap();
  const { dChunks } = await shardPlan();
  if (n < 2 + dChunks) return dispensarySitemap(n - 2);
  return productSitemap(n - 2 - dChunks);
}

// ─── Shard: static + location pages ─────────────────────────────────────────
async function pagesSitemap(): Promise<MetadataRoute.Sitemap> {
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
    // /advertise is auth-gated (advertiser accounts) — not indexable.
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
    const dispensaryRows = await fetchAll<{ city: string | null; state: string }>((f, t) =>
      supabase
        .from('dispensaries')
        .select('city, state')
        .eq('status', 'active')
        .range(f, t),
    );
    const productRows = await fetchAll<{
      category: { slug: string } | null;
      dispensary: { city: string | null; state: string } | null;
    }>((f, t) =>
      supabase
        .from('products')
        .select('category:categories(slug), dispensary:dispensaries(city, state)')
        .range(f, t),
    );

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

    return [...staticRoutes, ...locationRoutes];
  } catch {
    // Never let a transient DB hiccup break the sitemap; serve the static routes.
    return staticRoutes;
  }
}

// ─── Shard: strains, brands, categories, articles ───────────────────────────
async function catalogSitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  try {
    const supabase = await createClient();
    const [strains, brands, categories] = await Promise.all([
      supabase.from('strains').select('slug, updated_at'),
      supabase.from('brands').select('slug, updated_at'),
      supabase.from('categories').select('slug'),
    ]);
    return [
      ...(strains.data ?? []).map((s: Row) => ({
        url: `${SITE_URL}/strain/${s.slug}`,
        lastModified: new Date(s.updated_at),
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      })),
      ...(brands.data ?? []).map((b: Row) => ({
        url: `${SITE_URL}/brand/${b.slug}`,
        lastModified: new Date(b.updated_at),
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      })),
      ...(categories.data ?? []).map((c: { slug: string }) => ({
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
  } catch {
    return [];
  }
}

/** Page through a shard's [start, start+CHUNK) window in 1000-row sub-windows,
 * since PostgREST caps a single response at 1,000 rows. */
async function fetchChunk<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
  chunk: number,
): Promise<T[]> {
  const PAGE = 1000;
  const start = chunk * CHUNK;
  const end = start + CHUNK; // exclusive
  const out: T[] = [];
  for (let from = start; from < end; from += PAGE) {
    const { data } = await query(from, Math.min(from + PAGE, end) - 1);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

// ─── Shard: dispensaries (chunked) ──────────────────────────────────────────
async function dispensarySitemap(chunk: number): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = await createClient();
    const rows = await fetchChunk<Row>(
      (f, t) =>
        supabase
          .from('dispensaries')
          .select('slug, updated_at')
          .eq('status', 'active')
          .order('slug')
          .range(f, t),
      chunk,
    );
    return rows.map((d) => ({
      url: `${SITE_URL}/dispensary/${d.slug}`,
      lastModified: new Date(d.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch {
    return [];
  }
}

// ─── Shard: products (chunked) ──────────────────────────────────────────────
async function productSitemap(chunk: number): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = await createClient();
    const rows = await fetchChunk<{ id: string; updated_at: string }>(
      (f, t) => supabase.from('products').select('id, updated_at').order('id').range(f, t),
      chunk,
    );
    return rows.map((p) => ({
      url: `${SITE_URL}/product/${p.id}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  } catch {
    return [];
  }
}
