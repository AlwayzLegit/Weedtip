import type { Metadata } from 'next';
import { Download, Mail } from 'lucide-react';
import { requireAdmin } from '@/lib/admin';
import { inviteEmailHtml, reminderEmailHtml } from '@/lib/outreach-email';
import { SITE_URL } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';
import { SendBatchButton } from './send-button';

export const metadata: Metadata = { title: 'Outreach · Admin' };
export const dynamic = 'force-dynamic';

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card border-border bg-surface border p-4">
      <p className="text-muted text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="text-muted mt-0.5 text-xs">{sub}</p>}
    </div>
  );
}

/**
 * Claim-invite campaign console: funnel stats (eligible → sent → opened →
 * claimed), market targeting, the reminder drip, per-state + per-campaign
 * breakdowns, and live previews of both emails. Sending is gated on
 * OUTREACH_FROM_EMAIL so a dedicated subdomain sender must be configured
 * before the first email can go out.
 */
export default async function OutreachPage() {
  await requireAdmin();
  const supabase = await createClient();

  const cutoff = new Date(Date.now() - 5 * 86_400_000).toISOString();
  const [{ count: eligible }, { count: registryOnly }, { data: invites }, { count: remindersDue }] =
    await Promise.all([
      supabase
        .from('dispensaries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .is('owner_id', null)
        .not('email', 'is', null)
        .neq('email', ''),
      supabase
        .from('dispensaries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .is('owner_id', null)
        .or('email.is.null,email.eq.')
        .not('dcc_email', 'is', null),
      supabase
        .from('claim_invites')
        .select(
          'sent_at,opened_at,claimed_at,unsubscribed_at,reminder_sent_at,campaign,contact_source,dispensary:dispensaries(state)',
        ),
      supabase
        .from('claim_invites')
        .select('id', { count: 'exact', head: true })
        .not('sent_at', 'is', null)
        .lt('sent_at', cutoff)
        .is('claimed_at', null)
        .is('reminder_sent_at', null)
        .is('unsubscribed_at', null),
    ]);

  const all = invites ?? [];
  const sent = all.filter((i) => i.sent_at).length;
  const opened = all.filter((i) => i.opened_at).length;
  const claimed = all.filter((i) => i.claimed_at).length;
  const unsubscribed = all.filter((i) => i.unsubscribed_at).length;
  const senderConfigured = !!process.env.OUTREACH_FROM_EMAIL;

  // Funnel per campaign wave, newest-labelled first.
  const byCampaign = new Map<string, { sent: number; opened: number; claimed: number }>();
  for (const i of all) {
    if (!i.sent_at) continue;
    const key = i.campaign ?? '(unlabelled)';
    const row = byCampaign.get(key) ?? { sent: 0, opened: 0, claimed: 0 };
    row.sent += 1;
    if (i.opened_at) row.opened += 1;
    if (i.claimed_at) row.claimed += 1;
    byCampaign.set(key, row);
  }

  const sampleParams = {
    shopName: 'Green Example Dispensary',
    city: 'Oklahoma City',
    state: 'OK',
    license: 'OK-EX-00000',
    claimUrl: `${SITE_URL}/claim/invite/preview`,
    unsubscribeUrl: `${SITE_URL}/api/outreach/unsubscribe?token=preview`,
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Mail className="text-primary h-5 w-5" /> Claim outreach
        </h2>
        <p className="text-muted mt-1 text-sm">
          Invite unclaimed, license-verified shops to claim their listing. Batches are capped at
          50 per send; unsubscribes and already-invited shops are suppressed automatically.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Stat label="Email-reachable" value={String(eligible ?? 0)} sub="unclaimed, public email" />
        <Stat
          label="Registry-reachable"
          value={String(registryOnly ?? 0)}
          sub="state-record contact only"
        />
        <Stat label="Invited" value={String(sent)} />
        <Stat
          label="Opened"
          value={String(opened)}
          sub={sent ? `${Math.round((opened / sent) * 100)}% of sent` : undefined}
        />
        <Stat
          label="Claimed"
          value={String(claimed)}
          sub={sent ? `${Math.round((claimed / sent) * 100)}% of sent` : undefined}
        />
        <Stat label="Reminders due" value={String(remindersDue ?? 0)} sub={`${unsubscribed} unsubscribed`} />
      </div>

      {!senderConfigured && (
        <div className="rounded-card border-warning/40 bg-warning/10 border p-4 text-sm">
          <p className="font-medium">Sending is disabled until a dedicated sender is configured.</p>
          <p className="text-muted mt-1">
            Set <code className="text-primary">OUTREACH_FROM_EMAIL</code> in Vercel to an address
            on a separate subdomain verified in Resend (e.g.{' '}
            <code className="text-primary">invites@hello.weedtip.com</code>). Using a subdomain
            insulates transactional email deliverability from cold-outreach reputation. Optionally
            set <code className="text-primary">OUTREACH_POSTAL_ADDRESS</code> for the CAN-SPAM
            footer.
          </p>
        </div>
      )}

      <SendBatchButton enabled={senderConfigured} />

      {byCampaign.size > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Campaign waves</h3>
          <div className="rounded-card border-border overflow-x-auto border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border text-muted border-b text-left text-xs uppercase tracking-wide">
                  <th className="px-4 py-2.5">Campaign</th>
                  <th className="px-4 py-2.5 text-right">Sent</th>
                  <th className="px-4 py-2.5 text-right">Opened</th>
                  <th className="px-4 py-2.5 text-right">Claimed</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {[...byCampaign.entries()].map(([name, r]) => (
                  <tr key={name}>
                    <td className="px-4 py-2.5 font-medium">{name}</td>
                    <td className="px-4 py-2.5 text-right">{r.sent}</td>
                    <td className="px-4 py-2.5 text-right">
                      {r.opened} ({Math.round((r.opened / r.sent) * 100)}%)
                    </td>
                    <td className="text-primary px-4 py-2.5 text-right font-semibold">
                      {r.claimed} ({Math.round((r.claimed / r.sent) * 100)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Invite email preview</h3>
          <div
            className="rounded-card border-border overflow-hidden border bg-white"
            dangerouslySetInnerHTML={{ __html: inviteEmailHtml(sampleParams) }}
          />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Reminder email preview</h3>
          <div
            className="rounded-card border-border overflow-hidden border bg-white"
            dangerouslySetInnerHTML={{ __html: reminderEmailHtml(sampleParams) }}
          />
        </div>
      </section>

      <a
        href="/admin/exports/claims-outreach"
        download
        className="text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
      >
        <Download className="h-4 w-4" /> Download the full outreach CSV (all contact tiers)
      </a>
    </div>
  );
}
