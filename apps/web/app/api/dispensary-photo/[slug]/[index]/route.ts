import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Serves the Nth storefront photo for a dispensary's gallery, proxied live
 * from the Google Places Photo API (same pattern as /api/dispensary-cover:
 * only photo *references* are stored, the key stays server-side, and the CDN
 * caches the bytes hard). Index is 0-based into google_photo_names.
 */
export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; index: string }> },
) {
  const { slug, index } = await params;
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return new NextResponse('Not configured', { status: 404 });

  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || i > 9) return new NextResponse('Bad index', { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase
    .from('dispensaries')
    .select('google_photo_names')
    .eq('slug', slug)
    .maybeSingle();

  const name = data?.google_photo_names?.[i] ?? null;
  if (!name) return new NextResponse('No photo', { status: 404 });

  const mediaUrl = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=1000&key=${key}`;
  const res = await fetch(mediaUrl, { redirect: 'follow' });
  if (!res.ok) return new NextResponse('Upstream error', { status: 502 });

  const body = await res.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
    },
  });
}
