import type { NextRequest } from 'next/server';
import { runMenuSync } from '@/lib/menu-sync';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Scheduled menu refresh (see vercel.json crons): re-syncs auto_sync feed
 * connections whose last sync is older than ~20 hours, a few at a time.
 * Secured with CRON_SECRET (Vercel Cron sends `Authorization: Bearer <secret>`).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const service = createServiceClient();
  const staleBefore = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  const { data: sources } = await service
    .from('menu_sources')
    .select('id,dispensary_id,provider,feed_url,last_synced_at')
    .eq('auto_sync', true)
    .neq('status', 'syncing')
    .or(`last_synced_at.is.null,last_synced_at.lt.${staleBefore}`)
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .limit(25);

  const results: { id: string; ok: boolean; imported: number; error?: string }[] = [];
  for (const source of sources ?? []) {
    const r = await runMenuSync(service, source);
    results.push({ id: source.id, ok: r.ok, imported: r.imported, error: r.error });
  }

  return Response.json({ synced: results.length, results });
}
