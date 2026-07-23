/**
 * Typed query helpers. Thin, well-typed wrappers around RPCs and common reads so
 * web and mobile share one data-access vocabulary. The search helpers are the
 * swappable seam: today they call Postgres RPCs; a future Typesense/Meilisearch
 * backend can reimplement these without touching callers.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DispensaryBoundsSearchParams,
  DispensarySearchParams,
  ProductSearchParams,
} from '@weedtip/shared';
import type { Database } from './types/database.types';

type Client = SupabaseClient<Database>;

export async function searchDispensaries(supabase: Client, params: DispensarySearchParams) {
  return supabase.rpc('search_dispensaries', {
    search_query: params.query ?? undefined,
    lat: params.lat ?? undefined,
    lng: params.lng ?? undefined,
    radius_meters: params.radius_meters,
    filter_delivery: params.is_delivery ?? undefined,
    filter_pickup: params.is_pickup ?? undefined,
    filter_medical: params.is_medical ?? undefined,
    filter_recreational: params.is_recreational ?? undefined,
    filter_open_now: params.open_now ?? false,
    filter_category_slug: params.category_slug ?? undefined,
    filter_amenities: params.amenities && params.amenities.length ? params.amenities : undefined,
    result_limit: params.page_size,
    result_offset: params.page * params.page_size,
  });
}

/** Map-first finder: search whatever the map viewport shows ("Search this area"). */
export async function searchDispensariesBounds(
  supabase: Client,
  params: DispensaryBoundsSearchParams,
) {
  return supabase.rpc('search_dispensaries_bounds', {
    min_lat: params.min_lat,
    min_lng: params.min_lng,
    max_lat: params.max_lat,
    max_lng: params.max_lng,
    search_query: params.query ?? undefined,
    filter_delivery: params.is_delivery ?? undefined,
    filter_pickup: params.is_pickup ?? undefined,
    filter_medical: params.is_medical ?? undefined,
    filter_recreational: params.is_recreational ?? undefined,
    filter_open_now: params.open_now ?? false,
    filter_has_deals: params.has_deals ?? undefined,
    filter_category_slug: params.category_slug ?? undefined,
    filter_amenities: params.amenities && params.amenities.length ? params.amenities : undefined,
    origin_lat: params.origin_lat ?? undefined,
    origin_lng: params.origin_lng ?? undefined,
    sort_by: params.sort,
    result_limit: params.limit,
    result_offset: params.offset,
  });
}

/**
 * Pin-sized projection of the same viewport search: every matching shop in the
 * bbox (capped) so the map plots the full picture while the list paginates.
 */
export async function mapPinsBounds(
  supabase: Client,
  params: Omit<
    DispensaryBoundsSearchParams,
    'sort' | 'limit' | 'offset' | 'origin_lat' | 'origin_lng'
  > & {
    limit?: number;
  },
) {
  return supabase.rpc('map_pins_bounds', {
    min_lat: params.min_lat,
    min_lng: params.min_lng,
    max_lat: params.max_lat,
    max_lng: params.max_lng,
    search_query: params.query ?? undefined,
    filter_delivery: params.is_delivery ?? undefined,
    filter_pickup: params.is_pickup ?? undefined,
    filter_medical: params.is_medical ?? undefined,
    filter_recreational: params.is_recreational ?? undefined,
    filter_open_now: params.open_now ?? false,
    filter_has_deals: params.has_deals ?? undefined,
    filter_category_slug: params.category_slug ?? undefined,
    filter_amenities: params.amenities && params.amenities.length ? params.amenities : undefined,
    result_limit: params.limit ?? 3000,
  });
}

export async function searchProducts(supabase: Client, params: ProductSearchParams) {
  return supabase.rpc('search_products', {
    search_query: params.query ?? undefined,
    filter_category_slug: params.category_slug ?? undefined,
    filter_strain: params.strain_type ?? undefined,
    filter_dispensary_id: params.dispensary_id ?? undefined,
    min_price_cents: params.min_price_cents ?? undefined,
    max_price_cents: params.max_price_cents ?? undefined,
    in_stock_only: params.in_stock_only,
    result_limit: params.page_size,
    result_offset: params.page * params.page_size,
  });
}

/**
 * "Who delivers to my address?" — delivery-only listings publish only a
 * service-area county, so coverage is matched at the county level. Callers
 * derive (state, county) from the geocoder and pass it straight through; the
 * RPC normalizes a trailing "County" and matches case-insensitively.
 */
export async function deliveriesServingCounty(
  supabase: Client,
  params: { state: string; county: string },
) {
  return supabase.rpc('deliveries_serving_county', {
    p_state: params.state,
    p_county: params.county,
  });
}

export async function getDispensaryBySlug(supabase: Client, slug: string) {
  return supabase.from('dispensaries').select('*').eq('slug', slug).maybeSingle();
}

export async function listCategories(supabase: Client) {
  return supabase.from('categories').select('*').order('sort_order', { ascending: true });
}
