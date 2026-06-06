/**
 * Shared bits for enriching dispensary product cards from a brand's canonical
 * catalog entry (products.catalog_id → brand_products).
 */

/** Append to a products `.select(...)` to embed the linked catalog image. */
export const CATALOG_IMAGE_EMBED = 'catalog:brand_products(image_url)';

type CatalogEmbed = { image_url: string | null } | { image_url: string | null }[] | null;

/** A product's own first image, falling back to its linked catalog entry's image. */
export function cardImageUrl(p: {
  image_urls?: string[] | null;
  catalog?: CatalogEmbed;
}): string | null {
  if (p.image_urls && p.image_urls.length > 0) return p.image_urls[0] ?? null;
  const c = Array.isArray(p.catalog) ? p.catalog[0] : p.catalog;
  return c?.image_url ?? null;
}
