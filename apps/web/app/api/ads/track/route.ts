import { createClient } from '@/lib/supabase/server';

const SLOTS = new Set(['exclusive', 'featured', 'premium']);
const EVENTS = new Set(['search', 'impression', 'click']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fire-and-forget first-party ad metrics (zone searches, slot impressions and
 * clicks) — the inputs to region pricing. Called via navigator.sendBeacon, so
 * the body arrives as text. Anonymous callers are expected: record_ad_event
 * is SECURITY DEFINER and re-validates everything, silently dropping garbage.
 */
export async function POST(request: Request) {
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

  const supabase = await createClient();
  await supabase.rpc('record_ad_event', {
    p_region_id: region_id,
    p_event: event,
    p_zone_id: typeof zone_id === 'string' && UUID.test(zone_id) ? zone_id : null,
    p_dispensary_id:
      typeof dispensary_id === 'string' && UUID.test(dispensary_id) ? dispensary_id : null,
    p_slot_type:
      typeof slot_type === 'string' && SLOTS.has(slot_type)
        ? (slot_type as 'exclusive' | 'featured' | 'premium')
        : null,
  });
  return new Response(null, { status: 204 });
}
