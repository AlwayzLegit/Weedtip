'use server';

import { revalidatePath } from 'next/cache';
import { sendEmail } from '@/lib/email';
import { requireAdmin } from '@/lib/admin';
import { inviteEmailHtml, reminderEmailHtml } from '@/lib/outreach-email';
import { SITE_URL } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

const BATCH_LIMIT = 50;
/** An invite must be this old before its one-and-only reminder can go. */
const REMINDER_AFTER_DAYS = 5;

export type OutreachSendResult = {
  ok: boolean;
  message: string;
  sent?: number;
  failed?: number;
};

export type OutreachBatchOptions = {
  /** Two-letter state codes to target; empty/omitted = nationwide. */
  states?: string[];
  /**
   * Also reach shops with no public email through their state-registry
   * licensee contact (dcc_email) — unlocks e.g. California's ~1.5k listings.
   */
  useRegistryEmail?: boolean;
  /** Free-form campaign label stamped on every invite in this wave. */
  campaign?: string;
};

function normalizeStates(states?: string[]): string[] {
  return (states ?? [])
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]{2}$/.test(s));
}

/**
 * Send the next batch of claim invites (capped at BATCH_LIMIT per click),
 * optionally targeted to specific states and optionally extending reach to the
 * state-registry contact where no public email exists. Hard-gated on
 * OUTREACH_FROM_EMAIL: without a dedicated sending address this refuses to run,
 * so cold outreach can never ride the transactional domain by accident.
 * Suppression: shops already invited, already claimed, or whose address
 * unsubscribed are never selected.
 */
export async function sendClaimInviteBatch(
  options: OutreachBatchOptions = {},
): Promise<OutreachSendResult> {
  await requireAdmin();

  const from = process.env.OUTREACH_FROM_EMAIL;
  if (!from) {
    return {
      ok: false,
      message:
        'Set OUTREACH_FROM_EMAIL (a dedicated subdomain sender like invites@hello.weedtip.com, verified in Resend) to enable sending. This keeps cold outreach off the transactional domain.',
    };
  }

  const states = normalizeStates(options.states);
  const campaign =
    options.campaign?.trim().slice(0, 60) ||
    `${states.length ? states.join('-').toLowerCase() : 'nationwide'}-${new Date().toISOString().slice(0, 10)}`;

  const supabase = await createClient();

  // Eligible: active, unclaimed, contactable, never invited.
  let query = supabase
    .from('dispensaries')
    .select('id,slug,name,city,state,email,dcc_email,license_number,claim_invites!left(id)')
    .eq('status', 'active')
    .is('owner_id', null)
    .is('claim_invites.id', null)
    .order('rating_count', { ascending: false })
    .limit(BATCH_LIMIT * 3);
  // Broad contactability filter; exact address selection (trim + public-vs-
  // registry preference) happens in the mapping step below.
  query = options.useRegistryEmail
    ? query.or('email.not.is.null,dcc_email.not.is.null')
    : query.not('email', 'is', null).neq('email', '');
  if (states.length) query = query.in('state', states);

  const { data: candidates, error } = await query;
  if (error) return { ok: false, message: `Query failed: ${error.message}` };

  const { data: unsubs } = await supabase
    .from('claim_invites')
    .select('email')
    .not('unsubscribed_at', 'is', null);
  const suppressed = new Set((unsubs ?? []).map((u) => u.email.toLowerCase()));

  const batch = (candidates ?? [])
    .map((c) => {
      const publicEmail = c.email && c.email.trim() ? c.email.trim() : null;
      const registryEmail =
        options.useRegistryEmail && c.dcc_email && c.dcc_email.trim() ? c.dcc_email.trim() : null;
      const to = publicEmail ?? registryEmail;
      return to
        ? { ...c, to, source: publicEmail ? ('email' as const) : ('dcc_email' as const) }
        : null;
    })
    .filter((c): c is NonNullable<typeof c> => !!c && !suppressed.has(c.to.toLowerCase()))
    .slice(0, BATCH_LIMIT);
  if (batch.length === 0) {
    return { ok: true, message: 'No eligible shops left to invite for this target.', sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  for (const shop of batch) {
    const { data: invite, error: insErr } = await supabase
      .from('claim_invites')
      .insert({
        dispensary_id: shop.id,
        email: shop.to,
        contact_source: shop.source,
        campaign,
      })
      .select('token')
      .single();
    if (insErr || !invite) {
      failed += 1;
      continue;
    }
    const delivered = await sendEmail({
      to: shop.to,
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
    message: `Batch complete (${campaign}): ${sent} sent${failed ? `, ${failed} failed` : ''}.`,
    sent,
    failed,
  };
}

/**
 * One-time reminder drip: invites sent ≥REMINDER_AFTER_DAYS ago that never
 * converted (unclaimed), never got a reminder, and never unsubscribed. Capped
 * at BATCH_LIMIT per click; each invite gets AT MOST one reminder, ever — the
 * copy itself promises it's the last email.
 */
export async function sendClaimReminderBatch(): Promise<OutreachSendResult> {
  await requireAdmin();

  const from = process.env.OUTREACH_FROM_EMAIL;
  if (!from) {
    return { ok: false, message: 'Set OUTREACH_FROM_EMAIL to enable sending.' };
  }

  const supabase = await createClient();
  const cutoff = new Date(Date.now() - REMINDER_AFTER_DAYS * 86_400_000).toISOString();
  const { data: due, error } = await supabase
    .from('claim_invites')
    .select('token,email,dispensary:dispensaries(slug,name,city,state,license_number,owner_id)')
    .not('sent_at', 'is', null)
    .lt('sent_at', cutoff)
    .is('claimed_at', null)
    .is('reminder_sent_at', null)
    .is('unsubscribed_at', null)
    .limit(BATCH_LIMIT);
  if (error) return { ok: false, message: `Query failed: ${error.message}` };

  // Belt-and-braces: skip anything that gained an owner without the stamp.
  const batch = (due ?? []).filter((i) => {
    const d = i.dispensary as { owner_id: string | null } | null;
    return d && !d.owner_id;
  });
  if (batch.length === 0) {
    return { ok: true, message: 'No reminders due yet.', sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  for (const invite of batch) {
    const d = invite.dispensary as {
      slug: string;
      name: string;
      city: string | null;
      state: string;
      license_number: string | null;
    };
    const delivered = await sendEmail({
      to: invite.email,
      from,
      subject: `Reminder: claim ${d.name} on Weedtip (free)`,
      html: reminderEmailHtml({
        shopName: d.name,
        city: d.city,
        state: d.state,
        license: d.license_number,
        claimUrl: `${SITE_URL}/claim/invite/${invite.token}`,
        unsubscribeUrl: `${SITE_URL}/api/outreach/unsubscribe?token=${invite.token}`,
      }),
    });
    if (delivered) {
      sent += 1;
      await supabase
        .from('claim_invites')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('token', invite.token);
    } else {
      failed += 1;
    }
  }

  revalidatePath('/admin/outreach');
  return {
    ok: true,
    message: `Reminders: ${sent} sent${failed ? `, ${failed} failed` : ''}.`,
    sent,
    failed,
  };
}
