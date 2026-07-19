'use server';

import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { notifyAdmins } from '@/lib/notify';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const requestSchema = z.object({
  region_id: z.string().uuid(),
  slot_type: z.enum(['featured', 'premium', 'exclusive']),
});

export type AdRequestResult = { ok: boolean; message: string };

/**
 * Sold-out inventory → join the waitlist. Lands in the admin Ad desk as an
 * actionable request (plus an admin notification) — not an email thread.
 * RLS restricts the insert to the requester's own dispensary.
 */
export async function requestAdAvailability(input: {
  region_id: string;
  slot_type: 'featured' | 'premium' | 'exclusive';
}): Promise<AdRequestResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Invalid request.' };

  const { user } = await getAuth();
  if (!user) return { ok: false, message: 'Sign in to request availability.' };
  if (!(await rateLimit('ad-requests', { limit: 5, window: '60 s' }, user.id)).success) {
    return { ok: false, message: 'Too many requests - please wait a moment.' };
  }
  const supabase = await createClient();
  const { data: dispensary } = await supabase
    .from('dispensaries')
    .select('id, name')
    .eq('owner_id', user.id)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (!dispensary) return { ok: false, message: 'Claim your listing first.' };

  // Service client with an explicit re-open: the owner's RLS can insert but
  // not update, so a previously resolved/dismissed request would otherwise
  // no-op while the UI still says "you're on the list". Ownership is verified
  // above; admins are notified only when the row actually (re)opened.
  const service = createServiceClient();
  const { data: existing } = await service
    .from('ad_requests')
    .select('id, status')
    .eq('dispensary_id', dispensary.id)
    .eq('region_id', parsed.data.region_id)
    .eq('slot_type', parsed.data.slot_type)
    .eq('kind', 'availability')
    .maybeSingle();
  if (existing?.status === 'open') {
    return { ok: true, message: "You're already on the list - we'll reach out when a spot opens." };
  }
  const { error } = await service.from('ad_requests').upsert(
    {
      dispensary_id: dispensary.id,
      region_id: parsed.data.region_id,
      slot_type: parsed.data.slot_type,
      kind: 'availability',
      status: 'open',
    },
    { onConflict: 'dispensary_id,region_id,slot_type,kind' },
  );
  if (error) return { ok: false, message: 'Could not save your request.' };

  const { data: region } = await supabase
    .from('ad_regions')
    .select('name')
    .eq('id', parsed.data.region_id)
    .maybeSingle();
  await notifyAdmins({
    type: 'ad_request',
    title: `Waitlist: ${parsed.data.slot_type} in ${region?.name ?? 'a region'}`,
    body: `${dispensary.name} requested availability for a sold-out ${parsed.data.slot_type} spot.`,
    href: '/admin/ads-desk',
  });
  return {
    ok: true,
    message: "You're on the list — we'll reach out the moment a spot opens.",
  };
}

/**
 * Incumbent accepts their renewal offer: lands in the Ad desk for the team to
 * extend the term at the offered price.
 */
export async function acceptRenewalOffer(subscriptionId: string): Promise<AdRequestResult> {
  const { user } = await getAuth();
  if (!user) return { ok: false, message: 'Sign in first.' };
  if (!(await rateLimit('ad-requests', { limit: 5, window: '60 s' }, user.id)).success) {
    return { ok: false, message: 'Too many requests - please wait a moment.' };
  }
  const supabase = await createClient();

  const { data: sub } = await supabase
    .from('ad_subscriptions')
    .select(
      'id, renewal_price_cents, dispensary:dispensaries!inner(id, name, owner_id), slot:ad_slots(slot_type, region_id, region:ad_regions(name))',
    )
    .eq('id', subscriptionId)
    .maybeSingle();
  const disp = sub?.dispensary as { id: string; name: string; owner_id: string | null } | null;
  const slot = sub?.slot as {
    slot_type: 'featured' | 'premium' | 'exclusive';
    region_id: string;
    region: { name: string } | null;
  } | null;
  if (!sub || !disp || disp.owner_id !== user.id || !sub.renewal_price_cents || !slot) {
    return { ok: false, message: 'No renewal offer found for this placement.' };
  }

  // Service client: the owner's RLS can insert but not UPDATE, so a repeat
  // renewal (conflicting with last cycle's resolved row) would fail under the
  // authed client's ON CONFLICT DO UPDATE. Ownership verified above.
  const service = createServiceClient();
  const { error } = await service.from('ad_requests').upsert(
    {
      dispensary_id: disp.id,
      region_id: slot.region_id,
      slot_type: slot.slot_type,
      kind: 'renewal_accept',
      status: 'open',
    },
    { onConflict: 'dispensary_id,region_id,slot_type,kind' },
  );
  if (error) return { ok: false, message: 'Could not record your renewal.' };

  await notifyAdmins({
    type: 'ad_renewal',
    title: `Renewal accepted — ${slot.region?.name ?? 'region'}`,
    body: `${disp.name} accepted the ${slot.slot_type} renewal at $${(sub.renewal_price_cents / 100).toFixed(2)}/mo. Extend it from the Ad desk.`,
    href: '/admin/ads-desk',
  });
  return { ok: true, message: 'Renewal locked in — our team will confirm the new term shortly.' };
}
