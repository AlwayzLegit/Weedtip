import type { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Scheduled maintenance for the ad system (see vercel.json crons): releases
 * pending slot claims older than 30 minutes whose checkout was abandoned, so
 * the slot goes back on sale. Secured with CRON_SECRET — Vercel Cron sends it
 * as `Authorization: Bearer <CRON_SECRET>` automatically.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const service = createServiceClient();
  const { data, error } = await service.rpc('release_stale_ad_claims');
  if (error) return new Response(error.message, { status: 500 });

  return Response.json({ released: data ?? 0 });
}
