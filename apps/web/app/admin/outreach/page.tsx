import type { Metadata } from 'next';
import { Download, Mail } from 'lucide-react';
import { requireAdmin } from '@/lib/admin';
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
 * claimed), the batch-send trigger, and the raw CSV export. Sending is gated
 * on OUTREACH_FROM_EMAIL so a dedicated subdomain sender must be configured
 * before the first email can go out.
 */
export default async function OutreachPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ count: eligible }, { data: invites }] = await Promise.all([
    supabase
      .from('dispensaries')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .is('owner_id', null)
      .not('email', 'is', null)
      .neq('email', ''),
    supabase.from('claim_invites').select('sent_at,opened_at,claimed_at,unsubscribed_at'),
  ]);

  const all = invites ?? [];
  const sent = all.filter((i) => i.sent_at).length;
  const opened = all.filter((i) => i.opened_at).length;
  const claimed = all.filter((i) => i.claimed_at).length;
  const unsubscribed = all.filter((i) => i.unsubscribed_at).length;
  const senderConfigured = !!process.env.OUTREACH_FROM_EMAIL;

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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Email-reachable" value={String(eligible ?? 0)} sub="unclaimed, with email" />
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
        <Stat label="Unsubscribed" value={String(unsubscribed)} />
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
