'use server';

import { revalidatePath } from 'next/cache';
import { sendEmail } from '@/lib/email';
import { requireAdmin } from '@/lib/admin';
import { SITE_URL } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

const BATCH_LIMIT = 50;

export type OutreachSendResult = {
  ok: boolean;
  message: string;
  sent?: number;
  failed?: number;
};

function inviteEmailHtml(params: {
  shopName: string;
  city: string | null;
  state: string;
  license: string | null;
  claimUrl: string;
  unsubscribeUrl: string;
}): string {
  const where = params.city ? `${params.city}, ${params.state}` : params.state;
  const postal =
    process.env.OUTREACH_POSTAL_ADDRESS ?? 'Weedtip · weedtip.com · United States';
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
    <h2 style="margin:0 0 16px">Your dispensary is listed on Weedtip</h2>
    <p><strong>${params.shopName}</strong> in ${where} has a live listing on Weedtip,
    the cannabis discovery map. Shoppers nearby can already find your hours, location,
    and license details${params.license ? ` (license ${params.license} on file)` : ''}.</p>
    <p>Claiming is <strong>free</strong> and takes a few minutes — verified against the
    state license on file. Once claimed you control the listing:</p>
    <ul style="padding-left:20px">
      <li>Publish your menu and take pickup orders</li>
      <li>Post deals and promotions</li>
      <li>Add photos, hours, and contact info</li>
      <li>Reply to reviews</li>
    </ul>
    <p style="margin:24px 0">
      <a href="${params.claimUrl}"
         style="background:#10b981;color:#04231a;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;display:inline-block">
        Claim your free listing
      </a>
    </p>
    <p style="color:#666;font-size:13px">If you don't manage this dispensary, you can ignore
    this email or pass it to the owner.</p>
    <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" />
    <p style="color:#999;font-size:12px">
      ${postal}<br />
      Don't want emails about this listing?
      <a href="${params.unsubscribeUrl}" style="color:#999">Unsubscribe</a>
    </p>
  </div>`;
}

/**
 * Send the next batch of claim invites (capped at BATCH_LIMIT per click).
 * Hard-gated on OUTREACH_FROM_EMAIL: without a dedicated sending address this
 * refuses to run, so cold outreach can never ride the transactional domain by
 * accident. Suppression: shops already invited, already claimed, or whose
 * address unsubscribed are never selected.
 */
export async function sendClaimInviteBatch(): Promise<OutreachSendResult> {
  await requireAdmin();

  const from = process.env.OUTREACH_FROM_EMAIL;
  if (!from) {
    return {
      ok: false,
      message:
        'Set OUTREACH_FROM_EMAIL (a dedicated subdomain sender like invites@hello.weedtip.com, verified in Resend) to enable sending. This keeps cold outreach off the transactional domain.',
    };
  }

  const supabase = await createClient();

  // Eligible: active, unclaimed, has email, never invited, address not suppressed.
  const { data: candidates, error } = await supabase
    .from('dispensaries')
    .select('id,slug,name,city,state,email,license_number,claim_invites!left(id)')
    .eq('status', 'active')
    .is('owner_id', null)
    .not('email', 'is', null)
    .neq('email', '')
    .is('claim_invites.id', null)
    .order('rating_count', { ascending: false })
    .limit(BATCH_LIMIT * 2);
  if (error) return { ok: false, message: `Query failed: ${error.message}` };

  const { data: unsubs } = await supabase
    .from('claim_invites')
    .select('email')
    .not('unsubscribed_at', 'is', null);
  const suppressed = new Set((unsubs ?? []).map((u) => u.email.toLowerCase()));

  const batch = (candidates ?? [])
    .filter((c) => c.email && !suppressed.has(c.email.toLowerCase()))
    .slice(0, BATCH_LIMIT);
  if (batch.length === 0) {
    return { ok: true, message: 'No eligible shops left to invite.', sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  for (const shop of batch) {
    const { data: invite, error: insErr } = await supabase
      .from('claim_invites')
      .insert({ dispensary_id: shop.id, email: shop.email as string })
      .select('token')
      .single();
    if (insErr || !invite) {
      failed += 1;
      continue;
    }
    const delivered = await sendEmail({
      to: shop.email as string,
      from,
      subject: `${shop.name} is listed on Weedtip — claim your free listing`,
      html: inviteEmailHtml({
        shopName: shop.name,
        city: shop.city,
        state: shop.state,
        license: shop.license_number,
        claimUrl: `${SITE_URL}/claim/invite/${invite.token}`,
        unsubscribeUrl: `${SITE_URL}/api/outreach/unsubscribe?token=${invite.token}`,
      }),
    });
    if (delivered) {
      sent += 1;
      await supabase
        .from('claim_invites')
        .update({ sent_at: new Date().toISOString() })
        .eq('token', invite.token);
    } else {
      failed += 1;
      // Leave the row without sent_at — visible as a failed attempt, and the
      // unique(dispensary_id) constraint keeps us from double-inviting later.
    }
  }

  revalidatePath('/admin/outreach');
  return {
    ok: true,
    message: `Batch complete: ${sent} sent${failed ? `, ${failed} failed` : ''}.`,
    sent,
    failed,
  };
}
