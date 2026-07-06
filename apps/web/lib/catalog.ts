/**
 * Shared bits for enriching dispensary product cards from a brand's canonical
 * catalog entry (products.catalog_id → brand_products).
 */

/** Append to a products `.select(...)` to embed the linked catalog image. */
export const CATALOG_IMAGE_EMBED = 'catalog:brand_products(id,image_url)';

type CatalogEmbed =
  | { id: string; image_url: string | null }
  | { id: string; image_url: string | null }[]
  | null;

/**
 * Renderable src for a catalog image. Scraped catalog images live on brand
 * sites; those stream through /api/brand-product-image so rendering stays
 * same-origin (CSP) and referer-free. Locally-hosted paths pass through.
 */
export function catalogImageSrc(id: string, imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  return imageUrl.startsWith('http') ? `/api/brand-product-image/${id}` : imageUrl;
}

/** A product's own first image, falling back to its linked catalog entry's image. */
export function cardImageUrl(p: {
  image_urls?: string[] | null;
  catalog?: CatalogEmbed;
}): string | null {
  if (p.image_urls && p.image_urls.length > 0) return p.image_urls[0] ?? null;
  const c = Array.isArray(p.catalog) ? p.catalog[0] : p.catalog;
  return c ? catalogImageSrc(c.id, c.image_url) : null;
}
