/**
 * Typed query helpers. Thin, well-typed wrappers around RPCs and common reads so
 * web and mobile share one data-access vocabulary. The search helpers are the
 * swappable seam: today they call Postgres RPCs; a future Typesense/Meilisearch
 * backend can reimplement these without touching callers.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DispensarySearchParams, ProductSearchParams } from '@weedtip/shared';
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

export async function getDispensaryBySlug(supabase: Client, slug: string) {
  return supabase.from('dispensaries').select('*').eq('slug', slug).maybeSingle();
}

export async function listCategories(supabase: Client) {
  return supabase.from('categories').select('*').order('sort_order', { ascending: true });
}
