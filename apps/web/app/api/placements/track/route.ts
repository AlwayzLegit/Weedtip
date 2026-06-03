import { createClient } from '@/lib/supabase/server';

/**
 * Fire-and-forget placement impression/click tracking. Called via navigator
 * .sendBeacon, so the body arrives as text. Anonymous callers are expected —
 * the record_placement_event RPC is SECURITY DEFINER and validates input.
 */
export async function POST(request: Request) {
  let id: unknown;
  let type: unknown;
  try {
    const raw = await request.text();
    ({ id, type } = JSON.parse(raw));
  } catch {
    return new Response(null, { status: 204 });
  }

  if (typeof id !== 'string' || (type !== 'impression' && type !== 'click')) {
    return new Response(null, { status: 204 });
  }

  const supabase = await createClient();
  await supabase.rpc('record_placement_event', { p_placement_id: id, p_type: type });
  return new Response(null, { status: 204 });
}
