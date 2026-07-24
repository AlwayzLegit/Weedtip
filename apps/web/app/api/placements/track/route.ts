import { rateLimit } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fire-and-forget placement impression/click tracking. Called via navigator
 * .sendBeacon, so the body arrives as text. record_placement_event's EXECUTE
 * was revoked from anon in the metrics lockdown (20260714091000), so — exactly
 * like /api/ads/track — the write goes through the service client behind an IP
 * rate limit; the anon-client version silently recorded nothing, ever.
 */
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'placements-track';
  if (!(await rateLimit('placements-track', { limit: 60, window: '60 s' }, ip)).success) {
    return new Response(null, { status: 204 });
  }

  let id: unknown;
  let type: unknown;
  try {
    ({ id, type } = JSON.parse(await request.text()));
  } catch {
    return new Response(null, { status: 204 });
  }

  if (typeof id !== 'string' || !UUID.test(id) || (type !== 'impression' && type !== 'click')) {
    return new Response(null, { status: 204 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.rpc('record_placement_event', {
    p_placement_id: id,
    p_type: type,
  });
  // These numbers prove advertiser ROI — a silent failure here hid a total
  // outage for weeks. Log so monitoring can see the next one.
  if (error) console.error('[placements/track] record_placement_event failed:', error.message);
  return new Response(null, { status: 204 });
}
