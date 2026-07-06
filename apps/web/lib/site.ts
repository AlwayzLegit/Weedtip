/**
 * Canonical site metadata, shared by metadata, sitemap, robots, and manifest.
 *
 * SITE_URL resolves from NEXT_PUBLIC_SITE_URL (set in Vercel), falling back to the
 * Vercel-provided deployment URL, then the known production domain. This keeps
 * absolute URLs (Open Graph, canonical, sitemap) correct even before the env is set.
 */
const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
const fromVercel = process.env.NEXT_PUBLIC_VERCEL_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  : undefined;

// Production serves from www (the apex 308-redirects to it), so canonicals,
// sitemap entries, and JSON-LD must all use the www host — Google won't index
// sitemap URLs that redirect. Normalize the apex even if the env var uses it.
const CANONICAL_PROD = 'https://www.weedtip.com';
const raw = fromEnv ?? fromVercel ?? CANONICAL_PROD;
export const SITE_URL = raw === 'https://weedtip.com' ? CANONICAL_PROD : raw;
export const SITE_NAME = 'Weedtip';
export const SITE_DESCRIPTION =
  'Discover licensed dispensaries near you, browse menus, read reviews, find deals, and order for pickup or delivery.';
