import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Serves a dispensary's storefront cover photo from the Google Places Photo API.
 *
 * Compliance: we store only the photo *reference* (google_photo_name) and fetch
 * the image live here, proxying the bytes (same-origin, so next/image optimizes
 * it and the API key stays server-side). Heavily cached at the CDN/edge so the
 * Places Photo API is hit at most ~once per shop per cache window.
 *
 * Requires GOOGLE_PLACES_API_KEY in the server environment.
 *
 * Never 404s for missing photos: thousands of listing pages reference this URL
 * through next/image, which turns an upstream error into a broken-image 400.
 * Shops without a resolvable photo get a branded placeholder instead.
 */
export const runtime = 'nodejs';

let placeholderBytes: Buffer | null = null;

async function placeholder(maxAge: number) {
  placeholderBytes ??= await readFile(
    path.join(process.cwd(), 'public', 'storefront-placeholder.png'),
  );
  return new NextResponse(new Uint8Array(placeholderBytes), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}`,
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return placeholder(3600);

  const supabase = await createClient();
  const { data } = await supabase
    .from('dispensaries')
    .select('google_photo_name, google_place_id')
    .eq('slug', slug)
    .maybeSingle();

  // Prefer the cached photo reference; fall back to resolving it live from the
  // place_id (covers rows enriched before the photo name was stored).
  let name = data?.google_photo_name ?? null;
  if (!name && data?.google_place_id) {
    const det = await fetch(
      `https://places.googleapis.com/v1/places/${data.google_place_id}`,
      { headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'photos' } },
    );
    if (det.ok) {
      const j = (await det.json()) as { photos?: { name: string }[] };
      name = j.photos?.[0]?.name ?? null;
      if (name) {
        // Persist so the next cache miss skips the Place Details round trip.
        try {
          await createServiceClient()
            .from('dispensaries')
            .update({ google_photo_name: name })
            .eq('slug', slug);
        } catch {
          // Best-effort write-back; serving the photo matters more.
        }
      }
    }
  }
  // No photo on file for this place — placeholder for a day, in case the
  // owner enriches the listing later.
  if (!name) return placeholder(86400);

  const mediaUrl = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=1200&key=${key}`;
  const res = await fetch(mediaUrl, { redirect: 'follow' });
  // Transient upstream failure — short-lived placeholder so we retry soon.
  if (!res.ok) return placeholder(300);

  const body = await res.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
      // Cache hard: storefront photos rarely change; refreshed when re-enriched.
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
    },
  });
}
