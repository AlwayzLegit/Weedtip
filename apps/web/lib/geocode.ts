import type { BBox } from '@/lib/us-state-bounds';

/** A place the Mapbox geocoder resolved (city, zip, neighborhood, address…). */
export interface GeoPlace {
  id: string;
  name: string;
  center: { lat: number; lng: number };
  bbox: BBox | null;
  /** Two-letter state code from the feature context (e.g. "CA"), if resolvable. */
  state: string | null;
  /** City/place name from the feature or its context, if resolvable. */
  city: string | null;
}

type GeocodeContext = { id: string; text: string; short_code?: string };
type GeocodeFeature = {
  id: string;
  text: string;
  place_name: string;
  center: [number, number];
  bbox?: number[];
  context?: GeocodeContext[];
  properties?: { short_code?: string };
};

/** Pull the US state code + city out of a feature and its context chain. */
function placeParts(f: GeocodeFeature): { state: string | null; city: string | null } {
  const chain: GeocodeContext[] = [
    { id: f.id, text: f.text, short_code: f.properties?.short_code },
    ...(f.context ?? []),
  ];
  let state: string | null = null;
  let city: string | null = null;
  for (const c of chain) {
    if (c.id.startsWith('region') && c.short_code?.startsWith('US-')) {
      state = c.short_code.slice(3).toUpperCase();
    }
    if (!city && (c.id.startsWith('place') || c.id.startsWith('locality'))) {
      city = c.text;
    }
  }
  return { state, city };
}

/**
 * Client-side forward geocoding (Mapbox v5, US-only). Returns [] when the
 * token is missing, the query is too short, or the request fails — callers
 * treat "no places" and "geocoder unavailable" the same and fall back to
 * text search. Runs in the browser so the token's URL restrictions apply
 * (requests carry the site origin as the referrer).
 */
export async function geocodePlaces(
  query: string,
  opts: { limit?: number; signal?: AbortSignal } = {},
): Promise<GeoPlace[]> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const q = query.trim();
  if (!token || q.length < 3) return [];
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
    `?access_token=${token}&country=us&limit=${opts.limit ?? 5}` +
    `&types=region,postcode,district,place,locality,neighborhood,address`;
  try {
    const res = await fetch(url, { signal: opts.signal });
    if (!res.ok) return [];
    const json = (await res.json()) as { features?: GeocodeFeature[] };
    return (json.features ?? []).map((f) => ({
      id: f.id,
      // US-only search — the country suffix is noise in suggestions/headings.
      name: f.place_name.replace(/, United States$/, ''),
      center: { lat: f.center[1], lng: f.center[0] },
      bbox:
        f.bbox && f.bbox.length === 4 ? ([f.bbox[0], f.bbox[1], f.bbox[2], f.bbox[3]] as BBox) : null,
      ...placeParts(f),
    }));
  } catch {
    return [];
  }
}

/** Reverse geocode a point to its city/state ("Use my location"). */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoPlace | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
    `?access_token=${token}&country=us&limit=1&types=place,locality,postcode`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as { features?: GeocodeFeature[] };
    const f = json.features?.[0];
    if (!f) return null;
    return {
      id: f.id,
      name: f.place_name.replace(/, United States$/, ''),
      center: { lat, lng },
      bbox:
        f.bbox && f.bbox.length === 4 ? ([f.bbox[0], f.bbox[1], f.bbox[2], f.bbox[3]] as BBox) : null,
      ...placeParts(f),
    };
  } catch {
    return null;
  }
}

/**
 * Viewport radius (meters) that comfortably frames a place: half its bbox
 * diagonal for areas (cities, zips), a close-in default for point results
 * (addresses). Clamped to the /dispensaries page's accepted range.
 */
export function radiusForPlace(place: GeoPlace): number {
  if (!place.bbox) return 8_000;
  const [minLng, minLat, maxLng, maxLat] = place.bbox;
  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const dxMeters = (maxLng - minLng) * 111_320 * Math.cos(midLat);
  const dyMeters = (maxLat - minLat) * 110_540;
  const half = Math.sqrt(dxMeters * dxMeters + dyMeters * dyMeters) / 2;
  return Math.round(Math.min(Math.max(half, 3_000), 160_000));
}

/** /dispensaries URL that opens the interactive map centered on the place. */
export function dispensariesUrlForPlace(place: GeoPlace): string {
  const params = new URLSearchParams({
    lat: place.center.lat.toFixed(5),
    lng: place.center.lng.toFixed(5),
    radius_meters: String(radiusForPlace(place)),
    place: place.name,
  });
  return `/dispensaries?${params.toString()}`;
}
