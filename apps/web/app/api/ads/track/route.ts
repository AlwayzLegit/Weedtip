import { rateLimit } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';

const SLOTS = new Set(['exclusive', 'featured', 'premium']);
const EVENTS = new Set(['search', 'impression', 'click']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fire-and-forget first-party ad metrics (zone searches, slot impressions and
 * clicks) — the inputs to region pricing. Called via navigator.sendBeacon, so
 * the body arrives as text. Because these numbers price inventory and prove
 * advertiser ROI, record_ad_event is no longer anon/authenticated-callable —
 * the write goes through the service client here (behind an IP rate limit) so
 * the RPC can't be hit directly via PostgREST to inflate metrics.
 */
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'ads-track';
  if (!(await rateLimit('ads-track', { limit: 60, window: '60 s' }, ip)).success) {
    return new Response(null, { status: 204 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 204 });
  }

  const { event, region_id, zone_id, dispensary_id, slot_type } = body;
  if (
    typeof event !== 'string' ||
    !EVENTS.has(event) ||
    typeof region_id !== 'string' ||
    !UUID.test(region_id)
  ) {
    return new Response(null, { status: 204 });
  }

  const supabase = createServiceClient();
  await supabase.rpc('record_ad_event', {
    p_region_id: region_id,
    p_event: event,
    // Optional RPC args: omit (undefined) when the beacon didn't supply them.
    p_zone_id: typeof zone_id === 'string' && UUID.test(zone_id) ? zone_id : undefined,
    p_dispensary_id:
      typeof dispensary_id === 'string' && UUID.test(dispensary_id) ? dispensary_id : undefined,
    p_slot_type:
      typeof slot_type === 'string' && SLOTS.has(slot_type)
        ? (slot_type as 'exclusive' | 'featured' | 'premium')
        : undefined,
  });
  return new Response(null, { status: 204 });
}
