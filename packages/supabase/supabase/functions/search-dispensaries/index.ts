// ════════════════════════════════════════════════════════════════════════════
// Edge Function: search-dispensaries  (public — verify_jwt = false)
//
// Geo + full-text dispensary search. Thin, validated wrapper over the
// `search_dispensaries` RPC. This is the swappable seam: to move to
// Typesense/Meilisearch later, replace the RPC call below — the request/response
// contract (and every caller) stays the same.
//
// Accepts params via JSON body (POST) or query string (GET). Returns a paginated
// envelope with results carrying `distance_meters`, `is_open_now`, and `rank`.
// ════════════════════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handlePreflight, jsonResponse } from '../_shared/cors.ts';

// Mirrors @weedtip/shared SEARCH_DEFAULTS — kept inline so the function is
// self-contained in the Deno runtime.
const RADIUS_DEFAULT = 40_000;
const RADIUS_MAX = 160_000;
const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 100;

interface SearchParams {
  query: string | null;
  lat: number | null;
  lng: number | null;
  radius_meters: number;
  is_delivery: boolean | null;
  is_pickup: boolean | null;
  is_medical: boolean | null;
  is_recreational: boolean | null;
  open_now: boolean;
  category_slug: string | null;
  page: number;
  page_size: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toBoolOrNull(v: unknown): boolean | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return null;
}

function parseParams(raw: Record<string, unknown>): SearchParams {
  const lat = toNumberOrNull(raw.lat);
  const lng = toNumberOrNull(raw.lng);
  const radius = toNumberOrNull(raw.radius_meters);
  const page = toNumberOrNull(raw.page);
  const pageSize = toNumberOrNull(raw.page_size);

  return {
    query: raw.query ? String(raw.query).slice(0, 120) : null,
    lat: lat !== null ? clamp(lat, -90, 90) : null,
    lng: lng !== null ? clamp(lng, -180, 180) : null,
    radius_meters: radius !== null ? clamp(radius, 1, RADIUS_MAX) : RADIUS_DEFAULT,
    is_delivery: toBoolOrNull(raw.is_delivery),
    is_pickup: toBoolOrNull(raw.is_pickup),
    is_medical: toBoolOrNull(raw.is_medical),
    is_recreational: toBoolOrNull(raw.is_recreational),
    open_now: toBoolOrNull(raw.open_now) ?? false,
    category_slug: raw.category_slug ? String(raw.category_slug) : null,
    page: page !== null ? Math.max(0, Math.trunc(page)) : 0,
    page_size:
      pageSize !== null ? clamp(Math.trunc(pageSize), 1, PAGE_SIZE_MAX) : PAGE_SIZE_DEFAULT,
  };
}

async function readParams(req: Request): Promise<Record<string, unknown>> {
  if (req.method === 'GET') {
    return Object.fromEntries(new URL(req.url).searchParams.entries());
  }
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    const params = parseParams(await readParams(req));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        // Forward the caller's auth (if any) so RLS evaluates as them. Anonymous
        // callers still see the public storefront (active dispensaries).
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      },
    );

    const { data, error } = await supabase.rpc('search_dispensaries', {
      search_query: params.query,
      lat: params.lat,
      lng: params.lng,
      radius_meters: params.radius_meters,
      filter_delivery: params.is_delivery,
      filter_pickup: params.is_pickup,
      filter_medical: params.is_medical,
      filter_recreational: params.is_recreational,
      filter_open_now: params.open_now,
      filter_category_slug: params.category_slug,
      result_limit: params.page_size,
      result_offset: params.page * params.page_size,
    });

    if (error) {
      console.error('search_dispensaries RPC error', error);
      return jsonResponse({ error: error.message }, 400);
    }

    const rows = (data ?? []) as Array<{ total_count: number }>;
    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

    return jsonResponse({
      items: rows,
      page: params.page,
      pageSize: params.page_size,
      total,
      hasMore: (params.page + 1) * params.page_size < total,
    });
  } catch (err) {
    console.error('search-dispensaries unhandled error', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
