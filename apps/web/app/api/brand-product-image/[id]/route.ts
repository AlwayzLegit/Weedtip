import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Streams a brand-catalog product image stored as an external URL (scraped
 * from the brand's site). Proxying keeps rendering same-origin — external
 * image hosts stay out of the CSP and can't see visitor referers — and lets
 * the CDN cache hard. Only https URLs of image content within a size cap are
 * served; anything else 404s and the card falls back to placeholder art.
 */
export const runtime = 'nodejs';

const MAX_BYTES = 6 * 1024 * 1024;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse('Bad id', { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase
    .from('brand_products')
    .select('image_url')
    .eq('id', id)
    .maybeSingle();

  const url = data?.image_url;
  if (!url || !url.startsWith('https://')) return new NextResponse('No image', { status: 404 });

  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WeedtipBot/1.0)' },
  });
  if (!res.ok) return new NextResponse('Upstream error', { status: 502 });

  const type = res.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) return new NextResponse('Not an image', { status: 404 });

  const body = await res.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return new NextResponse('Too large', { status: 404 });

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
    },
  });
}
